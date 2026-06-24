/**
 * @file controllers/applicationController.js
 * @description Controller handling student admission application CRUD operations (Module 5)
 * and managing the validation state machine transitions (Module 7).
 * Connects directly to the notification engine (Module 9) to generate automatic emails
 * and in-app alerts on submissions, verifications, and admission approvals/rejections.
 */

const Application = require('../models/application');
const Course = require('../models/course');
const Institution = require('../models/institution');
const User = require('../models/user');
const { triggerNotification } = require('../services/notificationService');

/**
 * @function resolveTenantFromSubdomain
 * @description Extracts host from request header, resolves subdomain, 
 * and queries the database for the corresponding Institution tenant ID.
 * Falls back to DEFAULT_TENANT_ID during development.
 * 
 * @param {Object} req - Express request object.
 * @returns {Promise<mongoose.Types.ObjectId|null>} Tenant's ObjectId or null.
 */
const resolveTenantFromSubdomain = async (req) => {
    const host = req.headers.host;
    if (!host) {
        return null;
    }

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

/**
 * @route POST /api/applications
 * @description Submits a new application for a course under the institution.
 * Validates course existence and prevents duplicate applications for the same course by the same applicant.
 * Triggers an automatic submission email and in-app alert for the applicant (Module 9).
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
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

        // Verify that the target course exists and belongs to the resolved tenant
        const course = await Course.findOne({ _id: courseId, tenantId });
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found for this institution'
            });
        }

        // Prevent duplicates for the same course session by the same applicant
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

        // Create the application document in MongoDB (default status sets to 'submitted')
        const application = await Application.create({
            tenantId,
            courseId,
            applicantId: req.user.id,
            personalDetails: personalDetails || {},
            documents: documents || [],
            session: session || course.session || '',
            status: 'submitted'
        });

        /**
         * ==========================================
         * APPLICATION SUBMISSION TRIGGER (Module 9)
         * ==========================================
         * Fired automatically when a student successfully submits an application.
         * Creates an in-app alert and sends an confirmation email.
         */
        await triggerNotification({
            recipient: req.user.id,
            message: `Your application for ${course.name} has been successfully submitted.`,
            type: 'application_submission',
            tenantId,
            email: req.user.email,
            emailSubject: 'Application Submitted Successfully',
            emailMessage: `Hi ${req.user.name},\n\nYour application for the course "${course.name}" has been submitted successfully.\n\nStatus: Submitted.`
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

/**
 * @route GET /api/applications
 * @description Retrieves a list of applications.
 * Institution Admins view all applications inside their tenant.
 * Students can only view their own applications.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getApplications = async (req, res) => {
    try {
        const tenantId = await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid institution subdomain'
            });
        }

        const filter = { tenantId };
        // If user is not an admin, restrict query to their own applications
        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
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

/**
 * @route GET /api/applications/:id
 * @description Retrieves a single application detail.
 * Restricts access to owners (students) and tenant admins.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
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

        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
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

/**
 * @route PUT /api/applications/admin/:id
 * @description Admin updates the application workflow status.
 * Enforces strict transitions over: 'submitted', 'under_review', 'verified', 'admitted', 'rejected'.
 * Automatically generates specialized alerts (in-app + email) based on the target status (Module 9).
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
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

        // Valid Module 7 workflow statuses (excluding 'draft' since drafts cannot be directly set by admins)
        const VALID_STATUSES = ['submitted', 'under_review', 'verified', 'admitted', 'rejected'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }

        const application = await Application.findOne({ _id: req.params.id, tenantId })
            .populate('courseId', 'name')
            .populate('applicantId', 'name email');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const oldStatus = application.status;
        application.status = status;
        if (remarks) application.remarks = remarks;
        application.reviewedBy = req.user.id;
        application.reviewedAt = new Date();

        await application.save();

        /**
         * ==========================================
         * WORKFLOW STATUS TRIGGER (Module 9)
         * ==========================================
         * Automatically triggers custom alerts when the application status changes.
         * Specific templates are fired for:
         * - 'verified'       -> Verification Completion
         * - 'admitted'       -> Admission Approval
         * - 'rejected'       -> Admission Rejection
         */
        if (oldStatus !== status) {
            let notificationType = 'status_update';
            let emailSubject = `Application Status Updated: ${status.toUpperCase().replace('_', ' ')}`;
            let emailMessage = `Hi ${application.applicantId.name},\n\nYour application status for "${application.courseId.name}" has been updated to: ${status.toUpperCase().replace('_', ' ')}.\n\nRemarks: ${remarks || 'None'}\n\nBest regards,\nAdmissions Team`;

            if (status === 'verified') {
                notificationType = 'verification_completion';
                emailSubject = 'Application Verified Successfully';
                emailMessage = `Hi ${application.applicantId.name},\n\nYour application and documents for "${application.courseId.name}" have been verified successfully.\n\nStatus: Verified.`;
            } else if (status === 'admitted') {
                notificationType = 'admission_approval';
                emailSubject = 'Congratulations! You are Admitted';
                emailMessage = `Hi ${application.applicantId.name},\n\nWe are pleased to inform you that your application for "${application.courseId.name}" has been approved, and you have been admitted!\n\nStatus: Admitted.\n\nRemarks: ${remarks || 'None'}`;
            } else if (status === 'rejected') {
                notificationType = 'admission_rejection';
                emailSubject = 'Application Decision Update';
                emailMessage = `Hi ${application.applicantId.name},\n\nThank you for your interest in "${application.courseId.name}". After careful review, we regret to inform you that we are unable to offer you admission at this time.\n\nRemarks: ${remarks || 'None'}`;
            }

            await triggerNotification({
                recipient: application.applicantId._id,
                message: `Your application status for ${application.courseId.name} has been updated to "${status.replace('_', ' ')}".`,
                type: notificationType,
                tenantId,
                email: application.applicantId.email,
                emailSubject,
                emailMessage
            });
        }

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

/**
 * @route PUT /api/applications/:id
 * @description Student edits draft details.
 * Locked once status is no longer 'draft' or 'pending'.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
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

        // Lock edits if application is submitted or has moved past draft phase
        if (application.status !== 'draft' && application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending or draft applications can be edited'
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

/**
 * @route DELETE /api/applications/:id
 * @description Applicant withdraws a pending application, or Admin deletes a record.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const deleteApplication = async (req, res) => {
    try {
        const tenantId = req.user.role === 'instAdmin' || req.user.role === 'superAdmin' || req.user.role === 'admin'
            ? req.user.tenantId
            : await resolveTenantFromSubdomain(req);

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Unable to resolve institution'
            });
        }

        const filter = { _id: req.params.id, tenantId };

        // Non-admins can only delete/withdraw their own applications in 'draft' or 'pending' state
        if (req.user.role !== 'instAdmin' && req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
            filter.applicantId = req.user.id;
            filter.status = { $in: ['draft', 'pending'] };
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
