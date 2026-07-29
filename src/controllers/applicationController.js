// THIS MODULE HANDLES STUDENT ADMISSION APPLICATION CRUD OPERATIONS AND MANAGES THE VALIDATION WORKFLOW TRANSITIONS.
// SUPPORTED STATUSES ARE: draft → submitted → under_review → verified → admitted / rejected

const Application = require('../models/application');
const Course = require('../models/course');
const FormTemplate = require('../models/formTemplate');
const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const { resolveTenantFromSubdomain } = require('../middleware/tenantResolverMiddleware');
const { triggerNotification } = require('../services/notificationServices');

// ALLOWED STATUS TRANSITIONS FOR THE ADMISSION WORKFLOW
// EACH KEY IS THE CURRENT STATUS AND THE ARRAY REPRESENTS VALID NEXT STATUSES
const STATUS_TRANSITIONS = {
    draft: ['submitted'],
    submitted: ['under_review', 'rejected'],
    under_review: ['verified', 'rejected'],
    verified: ['admitted', 'rejected'],
    admitted: [],
    rejected: []
};

const VALID_STATUSES = ['draft', 'submitted', 'under_review', 'verified', 'admitted', 'rejected'];

// GET APPLICATION TIMELINE - RETURNS AUDIT LOG ENTRIES IN CHRONOLOGICAL ORDER (OLDER FIRST)
const getApplicationTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // BUILD FILTER BASED ON USER ROLE 
        const filter = { _id : id };

        // STUDENTS CAN ONLY VIEW THEIR OWN APPLICATIONS
        if(user.role === 'student') {
            filter.applicantId = user.id;
        }

        // INSTITUTION ADMINS AND SUPER ADMINS CAN VIEW ALL APPLICATIONS WITHIN THEIR TENANT
        if(user.role === 'instAdmin' || user.role === 'superAdmin') {
            if(user.role === 'instAdmin') {
                filter.tenantId = user.tenantId;
            }
        }

        // VERIFY APPLICATION EXISTS AND USER HAS ACCESS
        const application = await Application.findOne(filter);
        if(!application) {
            return res.status(404).json({
                success : false,
                message : 'Application not found or access denied'
            });
        }

        // FETCH AUDIT LOG ENTRIES FOR THIS APPLICATION
        const timeline = await AuditLog.find({
            applicationId : id,
            tenantId : application.tenantId
        })
            .populate('changedBy', 'name email role')
            .sort({ changedAt : 1 });

        res.status(200).json({
            success : true,
            count : timeline.length,
            data : timeline
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET WORKFLOW STATUSES AND TRANSITIONS - RETURNS ALL VALID STATUSES, THEIR LABEL
const getWorkflowStatuses = async (req, res) => {
    try {
        // DEFINE LABELS FOR EACH STATUS FOR FRONTEND DISPLAY PURPOSES
        const statusLabels = {
            draft: 'Draft',
            submitted: 'Submitted',
            under_review: 'Under Review',
            verified: 'Verified',
            admitted: 'Admitted',
            rejected: 'Rejected'
        };

        // BUILD TRANSITIONS WITH LABELS FOR FRONTEND DISPLAY
        const transitions = {};
        for(const [from, toList] of Object.entries(STATUS_TRANSITIONS)) {
            transitions[from] = toList.map(to => ({
                from,
                to,
                label : `${statusLabels[from]} → ${statusLabels[to]}`
            }));
        }

        res.status(200).json({
            success : true,
            data : {
                statuses : VALID_STATUSES.map(status => ({
                    value : status,
                    label : statusLabels[status],
                    isTerminal : STATUS_TRANSITIONS[status]?.length === 0 || false
                })),
                transitions,
                flow : [
                    { from: 'draft', to: 'submitted' },
                    { from: 'submitted', to: 'under_review' },
                    { from: 'submitted', to: 'rejected' },
                    { from: 'under_review', to: 'verified' },
                    { from: 'under_review', to: 'rejected' },
                    { from: 'verified', to: 'admitted' },
                    { from: 'verified', to: 'rejected' }
                ]
            }
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// CREATE (OR RETURN EXISTING) DRAFT APPLICATION FOR A COURSE - STUDENT ONLY
// Idempotent: if the student already has a draft for this course, that
// draft is returned instead of creating a duplicate. This is what the
// application form uses to obtain an applicationId before any documents
// can be uploaded against it.
const createOrGetDraft = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        const { courseId, session } = req.body;
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a course ID'
            });
        }

        const course = await Course.findOne({ _id: courseId, tenantId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found for this institution'
            });
        }

        // IF THE STUDENT ALREADY MOVED PAST DRAFT FOR THIS COURSE, DON'T ALLOW A NEW ONE
        const existingActive = await Application.findOne({
            tenantId,
            courseId,
            applicantId: req.user.id,
            status: { $in: ['submitted', 'under_review', 'verified', 'admitted'] }
        });
        if (existingActive) {
            return res.status(400).json({
                success: false,
                message: 'You have already applied for this course'
            });
        }

        // REUSE AN EXISTING DRAFT IF ONE EXISTS
        let application = await Application.findOne({
            tenantId,
            courseId,
            applicantId: req.user.id,
            status: 'draft'
        });

        if (application) {
            return res.status(200).json({
                success: true,
                message: 'Existing draft application found',
                data: application
            });
        }

        application = await Application.create({
            tenantId,
            courseId,
            applicantId: req.user.id,
            personalDetails: {},
            documents: [],
            session: session || course.session || '',
            status: 'draft'
        });

        res.status(201).json({
            success: true,
            message: 'Draft application created',
            data: application
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// SUBMIT A NEW APPLICATION - STUDENT ONLY FINAL SUBMISSION
// If `applicationId` is provided in the body and belongs to a draft owned
// by this student, that draft is converted to 'submitted' in place instead
// of creating a brand-new record (this is what lets the draft ->
// documents -> submit flow work without orphaning the draft). If no
// applicationId is given, behavior is unchanged from before: a new
// application is created directly with status 'submitted'.
const submitApplication = async (req, res) => {
    try {
        // RESOLVE TENANT FROM SUBDOMAIN
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid institution subdomain'
            });
        }

        const { applicationId, courseId, personalDetails, documents, session } = req.body;

        // ---- PATH A: CONVERTING AN EXISTING DRAFT INTO A SUBMISSION ----
        if (applicationId) {
            const draft = await Application.findOne({
                _id: applicationId,
                tenantId,
                applicantId: req.user.id
            });

            if (!draft) {
                return res.status(404).json({
                    success: false,
                    message: 'Application not found'
                });
            }

            if (draft.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    message: 'This application has already been submitted'
                });
            }

            const course = await Course.findOne({ _id: draft.courseId, tenantId });
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: 'Course not found for this institution'
                });
            }

            // ONLY OVERWRITE FIELDS EXPLICITLY PASSED — OTHERWISE KEEP WHATEVER
            // WAS ALREADY SAVED ON THE DRAFT VIA saveDraft()
            const effectivePersonalDetails = personalDetails || draft.personalDetails || {};
            if (personalDetails) draft.personalDetails = personalDetails;
            if (documents) draft.documents = documents;
            if (session) draft.session = session;

            // VALIDATE REQUIRED FIELDS BASED ON THE FORM TEMPLATE
            const draftTemplate = await FormTemplate.findOne({ courseId: draft.courseId, tenantId }).sort({ createdAt: -1 });
            if (draftTemplate) {
                for (let field of draftTemplate.fields) {
                    const isRequired = field.validation && field.validation.required;
                    if (isRequired) {
                        const value = effectivePersonalDetails[field.fieldKey];
                        if (value === undefined || value === null || value === '') {
                            return res.status(400).json({
                                success: false,
                                message: `Field ${field.label} is required`
                            });
                        }
                    }
                }
            }

            draft.status = 'submitted';
            draft.submittedAt = new Date();
            await draft.save();

            await AuditLog.create({
                tenantId,
                applicationId: draft._id,
                fromStatus: 'draft',
                toStatus: 'submitted',
                changedBy: req.user.id,
                remarks: 'Application submitted by student'
            });

            await triggerNotification({
                userId: req.user.id,
                tenantId: draft.tenantId,
                type: 'application_submitted',
                title: 'Application Submitted',
                message: `Your application for ${course.name} has been submitted successfully.`,
                email: req.user.email,
                emailSubject: `Application Submitted: ${course.name}`,
                emailMessage: `Dear ${req.user.name},\n\nYour application for the course "${course.name}" has been submitted successfully. \n\nWe will review your application and notify you of the outcome.\n\nThank you for applying.\n\nBest regards,\n${course.name} Admissions Team`,
                metadata: {
                    applicationId: draft._id,
                    courseName: course.name
                },
                sourceId: draft._id,
                sourceModel: 'Application'
            });

            return res.status(200).json({
                success: true,
                message: 'Application submitted successfully',
                data: draft
            });
        }

        // ---- PATH B: ORIGINAL BEHAVIOR — CREATE A NEW SUBMITTED APPLICATION ----

        // VALIDATE COURSE ID IS PROVIDED
        if (!courseId) {
            return res.status(400).json({
                success : false,
                message : 'Please provide a course ID'
            });
        }

        // VERIFIES WHETHER THE COURSE EXISTS UNDER THIS TENANT
        const course = await Course.findOne({ _id: courseId, tenantId });
        if (!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found for this institution'
            });
        }

        // PREVENT DUPLICATE APPLICATION FOR SAME COURSE BY SAME APPLICANT
        const existingApplication = await Application.findOne({
            tenantId,
            courseId,
            applicantId : req.user.id,
            status : { $in: ['submitted', 'under_review', 'verified', 'admitted'] }
        });
        if (existingApplication) {
            return res.status(400).json({
                success : false,
                message : 'You have already applied for this course'
            });
        }

        // VALIDATE REQUIRED FIELDS BASED ON THE FORM TEMPLATE
        const template = await FormTemplate.findOne({ courseId, tenantId }).sort({ createdAt : -1 });
        if(template) {
            for(let field of template.fields) {
                const isRequired = field.validation && field.validation.required;
                if(isRequired) {
                    const value = personalDetails ? personalDetails[field.fieldKey] : undefined;
                    if(value === undefined || value === null || value === '') {
                        return res.status(400).json({
                            success : false,
                            message : `Field ${field.label} is required`
                        });
                    }
                }
            }
        }

        // CREATE NEW APPLICATION RECORD WITH STATUS 'submitted' AND LOG THE ACTION IN AUDIT LOG
        const application = await Application.create({
            tenantId,
            courseId,
            applicantId : req.user.id,
            personalDetails : personalDetails || {},
            documents : documents || [],
            session : session || course.session || '',
            status : 'submitted',
            submittedAt : new Date()
        });

        await AuditLog.create({
            tenantId,
            applicationId: application._id,
            fromStatus: 'draft',
            toStatus: 'submitted',
            changedBy: req.user.id,
            remarks: 'Application submitted by student'
        });

        // TRIGGER NOTIFICATION TO STUDENT AND SEND EMAIL
        await triggerNotification({
            userId: req.user.id,
            tenantId: application.tenantId,
            type: 'application_submitted',
            title: 'Application Submitted',
            message: `Your application for ${course.name} has been submitted successfully.`,
            email: req.user.email,
            emailSubject: `Application Submitted: ${course.name}`,
            emailMessage: `Dear ${req.user.name},\n\nYour application for the course "${course.name}" has been submitted successfully. \n\nWe will review your application and notify you of the outcome.\n\nThank you for applying.\n\nBest regards,\n${course.name} Admissions Team`,
            metadata: {
                applicationId: application._id,
                courseName: course.name
            },
            sourceId: application._id,
            sourceModel: 'Application'
        });

        res.status(201).json({
            success : true,
            message : 'Application submitted successfully',
            data : application
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// SAVE DRAFT FUNCTION - FOR STUDENTS PARTIAL UPDATES
const saveDraft = async (req, res) => {
    try {
        // RESOLVE TENANT FROM SUBDOMAIN
        const tenantId = await resolveTenantFromSubdomain(req);
        if(!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid Institution subdomain'
            });
        }

        const { id } = req.params;
        const { personalDetails, documents, session } = req.body;

        // FIND THE APPLICATION - MUST BELONG TO THIS STUDENT AND TENANT
        const application = await Application.findOne({
            _id : id,
            tenantId,
            applicantId : req.user.id
        });
        if(!application) {
            return res.status(404).json({
                success : false,
                message : 'Application not found'
            });
        }

        // ONLY DRAFT APPLICATIONS CAN BE EDITED - ONCE SUBMITTED, NO FURTHER EDITS ALLOWED
        if(application.status !== 'draft') {
            return res.status(400).json({
                success : false,
                message : 'Only draft applications can be edited'
            });
        }

        // UPDATE FIELDS 
        if(personalDetails) application.personalDetails = personalDetails;
        if(documents) application.documents = documents;
        if(session) application.session = session;

        await application.save();

        res.status(200).json({
            success : true,
            message : 'Draft saved successfully',
            data : application
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET MY APPLICATION - GET ALL APPLICATIONS FOR THE LOGGED-IN STUDENT
const getMyApplication = async (req, res) => {
    try {
        const user = req.user;

        // ONLY STUDENTS CAN ACCESS 
        if(user.role !== 'student') {
            return res.status(403).json({
                success : false,
                message : 'Access denied'
            });
        }

        // FIND ALL APPLICATIONS FOR THIS STUDENT
        const applications = await Application.find({
            applicantId : user.id,
            tenantId : user.tenantId
        })
            .populate('courseId', 'name session')
            .sort({ createdAt : -1 });

        res.status(200).json({
            success : true,
            count : applications.length,
            data : applications
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GETS ALL APPLICATIONS - RETURNS ALL APPLICATIONS FOR THE INSTITUTION ADMIN WITHIN THEIR TENANT
const getAllApplications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // FIND ALL APPLICATIONS FOR THIS TENANT
        const applications = await Application.find({ tenantId })
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: applications.length,
            data: applications
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET A SINGLE APPLICATION BY ID - WITHIN TENANT AND ROLE CHECK
const getApplicationById = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        const filter = { _id: req.params.id, tenantId };

        // NON-ADMINS CAN ONLY VIEW THEIR OWN APPLICATIONS
        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin') {
            filter.applicantId = req.user.id;
        }

        const application = await Application.findOne(filter)
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session eligibilityCriteria requiredDocuments admissionCapacity');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        res.status(200).json({
            success: true,
            data: application
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// UPDATES APPLICATION STATUS - ONLY INSTITUTION ADMIN, WITHIN TENANT (ADMISSION WORKFLOW)
const updateApplicationStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        const { id } = req.params;
        const { status, remarks } = req.body;

        // VALIDATE STATUS 
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success : false,
                message : `Status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        // FIND THE APPLICATION
        const application = await Application.findOne({ _id : id, tenantId });
        if (!application) {
            return res.status(404).json({
                success : false,
                message : 'Application not found'
            });
        }

        // VALIDATE TRANSITION
        const currentStatus = application.status;
        const allowedNext = STATUS_TRANSITIONS[currentStatus] || [];

        if (!allowedNext.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot move from '${currentStatus}' to '${status}'. Allowed: ${allowedNext.join(', ') || 'none'}`
            });
        }

        // UPDATE THE STATUS
        application.status = status;
        if (remarks) application.remarks = remarks;
        application.reviewedBy = req.user.id;
        application.reviewedAt = new Date();

        await application.save();

        // LOG THE STATUS CHANGE IN AUDIT LOG
        await AuditLog.create({
            tenantId,
            applicationId: application._id,
            fromStatus: currentStatus,
            toStatus: status,
            changedBy: req.user.id,
            remarks: remarks || `Status changed from ${currentStatus} to ${status}`
        });

        // TRIGGER NOTIFICATION TO STUDENT
        const studentUser = await User.findById(application.applicantId);
        await triggerNotification({
            userId: application.applicantId,
            tenantId: application.tenantId,
            type: 'status_updated',
            title: 'Application Status Updated',
            message: `Your application status has been updated to ${status}.`,
            email: studentUser?.email,
            emailSubject: `Application Status: ${status}`,
            emailMessage: `Dear ${studentUser?.name},\n\nYour application status has been updated to "${status}".\n\nRemarks: ${remarks || 'No additional remarks provided.'}\n\nPlease log in to your account for more details.\n\nBest regards,\nAdmissions Team`,
            metadata: {
                applicationId: application._id,
                oldStatus: currentStatus,
                newStatus: status
            },
            sourceId: application._id,
            sourceModel: 'Application'
        });

        res.status(200).json({
            success: true,
            message: 'Application status updated successfully',
            data: application
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// FILTER APPLICATIONS FUNCTION - FILTERS APPLICATIONS WITH ADVANCED CRITERIA
const filterApplications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { status, courseId, applicantId, dateFrom, dateTo } = req.query;
        const filter = { tenantId };

        // APPLY FILTERS BASED ON QUERY PARAMETERS
        if(status) filter.status = status;
        if(courseId) filter.courseId = courseId;
        if(applicantId) filter.applicantId = applicantId;
        if(dateFrom) filter.createdAt = { $gte : new Date(dateFrom) };
        if(dateTo) {
            if(!filter.createdAt) filter.createdAt = {};
            filter.createdAt.$lte = new Date(dateTo);
        }

        const applications = await Application.find(filter)
            .populate('applicantId', 'name email')
            .populate('courseId', 'name session')
            .sort({ createdAt : -1 });

        res.status(200).json({
            success : true,
            count : applications.length,
            data : applications
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        })
    }
};

// DELETE AN APPLICATION - ADMIN ONLY
const deleteApplication = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // FIND AND DELETE THE APPLICATION
        const application = await Application.findOneAndDelete({
            _id : req.params.id,
            tenantId
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // DELETE ASSCIATED AUDIT LOGS
        await AuditLog.deleteMany({
            applicationId: application._id,
            tenantId
        });

        res.status(200).json({
            success: true,
            message: 'Application deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    createOrGetDraft,
    submitApplication,
    saveDraft,
    getMyApplication,
    getAllApplications,
    getApplicationById,
    updateApplicationStatus,
    filterApplications,
    deleteApplication,
    getApplicationTimeline,
    getWorkflowStatuses
};