/**
 * @file controllers/applicationController.js
 * @description Controller handling student admission application CRUD operations
 * and managing the validation state machine transitions .
 * Connects directly to the notification engine to generate automatic emails
 * and in-app alerts on submissions, verifications, and admission approvals/rejections.
 */

const Application = require('../models/application');
const Course = require('../models/course');
const Institution = require('../models/institution');
const FormTemplate = require('../models/formTemplate');
const User = require('../models/user');


// HELPER FUNCTION - RESOLVE TENANT ID FROM SUBDOMAIN
const resolveTenantFromSubdomain = async (req) => {
    const host = req.headers.host;
    if (!host) {
        return null;
    }

    // FOR THE DEVELOPMENT PHASE ONLY
    let subdomain = host.split('.')[0];
    if (subdomain === 'localhost' || subdomain === '127.0.0.1' || subdomain === 'www') {
        if (process.env.DEFAULT_TENANT_ID) {
            return process.env.DEFAULT_TENANT_ID;
        }
        return null;
    }

    const institution = await Institution.findOne({ subdomain }).select('_id');
    if (!institution) {
        return null;
    }
    return institution._id;
};

const STATUS_TRANSITIONS = {
    draft: ['submitted'],
    submitted: ['under_review', 'rejected'],
    under_review: ['verified', 'rejected'],
    verified: ['admitted', 'rejected'],
    admitted: [],
    rejected: []
};

const VALID_STATUSES = ['draft', 'submitted', 'under_review', 'verified', 'admitted', 'rejected'];

// CREATES A NEW APPLICATION - APPLICANT (PUBLIC/AUTHENTICATED USER)
const submitApplication = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid institution subdomain'
            });
        }

        const { courseId, personalDetails, documents, session } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success : false,
                message : 'Please provide a course ID'
            });
        }

        // VERIFIES WETHER THE COURSE EXISTS UNDER THIS TENANT
        const course = await Course.findOne({ _id: courseId, tenantId });
        if (!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found for this institution'
            });
        }

        // PREVENTS DUPLICATE APPLICATION FOR SAME COURSE BY SAME APPLICANT
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

        const template = await FormTemplate.findOne({ courseId, tenantId }).sort({ createdAt : -1 });
        if(template) {
            for(let field of template.fields) {
                if(field.validation && field.validation.required) {
                    const value = personalDetails ? personalDetails[field.fieldId] : undefined;
                    if(value === undefined || value === null || value === '') {
                        return res.status(400).json({
                            success : false,
                            message : `Field ${field.label} is required`
                        });
                    }
                }
            }
        }

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

// SAVE DRAFT FUNCTION - FOR STUDENTS
const saveDraft = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if(!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid Institution subdomain'
            });
        }

        const { id } = req.params;
        const { personalDetails, documents, session } = req.body;

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

        if(application.status !== 'draft') {
            return res.status(400).json({
                success : false,
                message : 'Only draft applications can be edited'
            });
        }

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

// GET MY APPLICATION - ESPECIALLY FOR STUDENTS 
const getMyApplication = async (req, res) => {
    try {
        const user = req.user;
        if(user.role !== 'student') {
            return res.status(403).json({
                success : false,
                message : 'Access denied'
            });
        }

        const applications = await Application.find({
            applicationId : user.id,
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

// GETS ALL APPLICATIONS - INSTITUTION ADMIN (ALL), APPLICANT (OWN ONLY)
const getAllApplications = async (req, res) => {
    try {
        const tenantId = req.await.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        const applications = await Application.find({ tenantId })
            .populate('applicationId', 'name email')
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

// GETS SINGLE APPLICATION BY ID - WITHIN TENANT
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

        // NON-ADMINS CAN ONLY VIEW THEIR OWN APPLICATION
        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin') {
            filter.applicantId = req.user.id;
        }

        const application = await Application.findOne(filter)
            .populate('applicationId', 'name email')
            .populate('courseId', 'name session eligibilityCriteria');

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

// UPDATES APPLICATION STATUS - ONLY INSTITUTION ADMIN, WITHIN TENANT
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

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success : false,
                message : `Status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        const application = await Application.findOne({ _id : id, tenantId });
        if (!application) {
            return res.status(404).json({
                success : false,
                message : 'Application not found'
            });
        }

        const currentStatus = application.status;
        const allowedNext = STATUS_TRANSITIONS[currentStatus] || [];

        if (!allowedNext.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot move from '${currentStatus}' to '${status}'. Allowed: ${allowedNext.join(', ') || 'none'}`
            });
        }

        application.status = status;
        if (remarks) application.remarks = remarks;
        application.reviewedBy = req.user.id;
        application.reviewedAt = new Date();

        await application.save();

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

// FILTER APPLICATIONS FUNCTION - FOR ADMIN DASHBOARD
const filterApplications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { status, courseId, applicationId, dateFrom, dateTo } = req.query;
        const filter = tenantId;

        if(status) filter.status = status;
        if(courseId) filter.courseId = courseId;
        if(applicationId) filter.applicationId = applicationId;
        if(dateFrom) filter.createdAt = { $gte : new Date(dateFrom) };
        if(dateTo) {
            if(!filter.createdAt) filter.createdAt = {};
            filter.createdAt.$lte = new Date(dateTo);
        }

        const applications = await Application.find(filter)
            .populate('applicationId', 'name email')
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

// DELETE APPLICATION - ADMIN ONLY
const deleteApplication = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

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
    submitApplication,
    saveDraft,
    getMyApplication,
    getAllApplications,
    getApplicationById,
    updateApplicationStatus,
    filterApplications,
    deleteApplication
};

