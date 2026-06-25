/**
 * @file controllers/applicationController.js
 * @description Controller handling student admission application CRUD operations (Module 5)
 * and managing the validation state machine transitions (Module 7).
 * Connects directly to the notification engine (Module 9) to generate automatic emails
 * and in-app alerts on submissions, verifications, and admission approvals/rejections.
 */

const Application = require('../models/Application');
const Course = require('../models/course');
const Institution = require('../models/Institution');

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

// CREATES A NEW APPLICATION - APPLICANT (PUBLIC/AUTHENTICATED USER)
const createApplication = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        const { courseId, personalDetails, documents, session } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a course ID'
            });
        }

        // VERIFIES WETHER THE COURSE EXISTS UNDER THIS TENANT
        const course = await Course.findOne({ _id: courseId, tenantId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found for this institution'
            });
        }

        // PREVENTS DUPLICATE APPLICATION FOR SAME COURSE BY SAME APPLICANT
        const existingApplication = await Application.findOne({
            tenantId,
            courseId,
            applicantId: req.user.id
        });
        if (existingApplication) {
            return res.status(400).json({
                success: false,
                message: 'You have already applied for this course'
            });
        }

        const application = await Application.create({
            tenantId,
            courseId,
            applicantId: req.user.id,
            personalDetails: personalDetails || {},
            documents: documents || [],
            session: session || course.session || '',
            status: 'draft'
        });

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: application
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GETS ALL APPLICATIONS - INSTITUTION ADMIN (ALL), APPLICANT (OWN ONLY)
const getApplications = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        // ADMINS CAN SEE ALL APPLICATIONS; APPLICANTS SEE ONLY THEIR OWN
        const filter = { tenantId };
        if (req.user.role !== 'instAdmin') {
            filter.applicantId = req.user.id;
        }

        const applications = await Application.find(filter)
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
        if (req.user.role !== 'instAdmin') {
            filter.applicantId = req.user.id;
        }

        const application = await Application.findOne(filter)
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

        const { status, remarks } = req.body;

        const VALID_STATUSES = ['draft', 'pending', 'under_review', 'verified', 'admitted', 'rejected'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        // WORKFLOW VALIDATION - STATUS CAN ONLY MOVE IN CORRECT ORDER
        const ALLOWED_TRANSITIONS = {
            draft: ['pending'],
            pending: ['under_review', 'rejected'],
            under_review: ['verified', 'rejected'],
            verified: ['admitted', 'rejected'],
            admitted: [],
            rejected: []
        };

        const application = await Application.findOne({ _id: req.params.id, tenantId });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const currentStatus = application.status;
        const allowedNext = ALLOWED_TRANSITIONS[currentStatus];

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

// UPDATES APPLICATION DETAILS - APPLICANT ONLY, ONLY WHILE DRAFT OR PENDING
const updateApplication = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        const application = await Application.findOne({
            _id: req.params.id,
            tenantId,
            applicantId: req.user.id
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // LOCKS EDITS ONCE THE APPLICATION MOVES PAST PENDING
        if (application.status !== 'pending' && application.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft or pending applications can be edited'
            });
        }

        const { personalDetails, documents, session } = req.body;

        if (personalDetails) application.personalDetails = personalDetails;
        if (documents) application.documents = documents;
        if (session) application.session = session;

        await application.save();

        res.status(200).json({
            success: true,
            message: 'Application updated successfully',
            data: application
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// DELETES / WITHDRAWS APPLICATION - APPLICANT (OWN, PENDING ONLY) OR ADMIN
const deleteApplication = async (req, res) => {
    try {
        const tenantId = req.user.role === 'instAdmin'
            ? req.user.tenantId
            : await resolveTenantFromSubdomain(req);

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Unable to resolve institution'
            });
        }

        const filter = { _id: req.params.id, tenantId };

        // NON-ADMINS CAN ONLY DELETE THEIR OWN PENDING APPLICATIONS
        if (req.user.role !== 'instAdmin') {
            filter.applicantId = req.user.id;
            filter.status = 'pending';
        }

        const application = await Application.findOneAndDelete(filter);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found or cannot be withdrawn at this stage'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Application withdrawn successfully'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    createApplication,
    getApplications,
    getApplicationById,
    updateApplicationStatus,
    updateApplication,
    deleteApplication
};
