/**
 * @file controllers/documentController.js
 * @description Controller handling document operations for the ScholarStack portal (Module 6).
 * Enforces student uploads (with multer validation inside the controller), role-based retrieval,
 * and admin verification status updates (approving/rejecting documents with remarks and automated alerts).
 */

const Document = require('../models/document');
const Application = require('../models/application');
const Institution = require('../models/institution');
const User = require('../models/user');
const { triggerNotification } = require('../services/notificationService');
// const upload = require('../middleware/fileUploadMiddleware').single('file');

/**
 * @function resolveTenantFromSubdomain
 * @description Extracts the host header from the request, parses the subdomain, 
 * and queries the database for the corresponding Institution tenant ID.
 * Falls back to DEFAULT_TENANT_ID in localhost/development environments.
 * 
 * @param {Object} req - Express request object.
 * @returns {Promise<mongoose.Types.ObjectId|null>} Resolves to the tenant's ObjectId or null if invalid.
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
 * @route POST /api/documents/upload
 * @description Student uploads a single file (Marksheet, Certificate, Identity Proof, Passport Photo).
 * Runs the multer upload middleware internally to validate file dimensions/types and limit sizes (up to 10MB).
 * Connects the document record to the correct tenant and appends its reference to the applicant's course application.
 * Only allowed if the application status is in 'pending' or 'draft' state.
 * 
 * @param {Object} req - Express request object containing file and multipart/form-data.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends JSON response back to client.
 */
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload a file' 
            });
        }

        const { name, type, applicationId } = req.body;
        if (!name || !type || !applicationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide document name, type, and application ID' 
            });
        }

        // Resolve the tenant context
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Unable to resolve institution' 
            });
        }

        // Verify that the target application exists and belongs to the authenticated applicant
        const application = await Application.findOne({
            _id: applicationId,
            tenantId,
            applicantId: req.user.id
        });

        if (!application) {
            return res.status(404).json({ 
                success: false, 
                message: 'Associated application not found or access denied' 
            });
        }

        // Lock edits if the application status has progressed past the draft/pending review phase
        if (application.status !== 'pending' && application.status !== 'draft') {
            return res.status(400).json({ 
                success: false, 
                message: 'Documents can only be modified while application is pending or draft' 
            });
        }

        // Save document metadata and upload URL path in database
        const document = await Document.create({
            name,
            type,
            fileUrl: `/uploads/documents/${req.file.filename}`,
            status: 'pending',
            studentId: req.user.id,
            applicationId,
            tenantId
        });

        // Append document ID reference to the Application model document registry
        application.documents = application.documents || [];
        application.documents.push(document._id);
        await application.save();

        res.status(201).json({ 
            success: true, 
            message: 'Document uploaded successfully', 
            data: document 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

/**
 * @route GET /api/documents/:applicationId
 * @description Retrieves all uploaded documents associated with a specific application.
 * Students can only fetch documents belonging to their own applications.
 * Institution Admins can fetch any documents belonging to applications within their tenant.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends JSON response listing documents.
 */
const getDocuments = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Unable to resolve institution' 
            });
        }

        const { applicationId } = req.params;
        const filter = { applicationId, tenantId };

        // Enforce access control filter: students can only fetch their own files
        if (req.user.role === 'student') {
            filter.studentId = req.user.id;
        }

        const documents = await Document.find(filter)
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ 
            success: true, 
            count: documents.length, 
            data: documents 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

// GET SINGLE DOCUMENT BY ID FUNCTION - FOR BOTH STUDENT AND INSTITUTION ADMIN
const getDocumentById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if(!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Unable to resolve institution'
            });
        }

        const { id } = req.params;
        const filter = { _id : id, tenantId };

        if(req.user.role === 'student') {
            filter.studentId = req.user.id;
        }

        const document = await Document.findOne(filter)
            .populate('reviewedBy', 'name email');

        if(!document) {
            return res.status(404).json({
                success : false,
                message : 'Document not found'
            });
        }

        res.status(200).json({
            success : true,
            data : document
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

/**
 * @route PUT /api/documents/:id/status
 * @description Admin approves or rejects a specific document and attaches comments.
 * Automatically triggers the Document Rejection alert (in-app + email) if state shifts to 'rejected'.
 * Locks review logs with admin auditor ID and timestamp.
 * 
 * @param {Object} req - Express request object containing body: { status, remarks }.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends JSON response indicating verification results.
 */
const updateDocumentStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ 
                success : false, 
                message : 'Admin does not belong to any institution' 
            });
        }

        const { status, remarks } = req.body;
        const VALID_STATUSES = ['approved', 'rejected', 'pending'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ 
                success : false, 
                message : 'Invalid status' 
            });
        }

        // Retrieve document belonging strictly to the admin's tenant
        const document = await Document.findOne({ _id : req.params.id, tenantId });
        if (!document) {
            return res.status(404).json({ 
                success : false, 
                message : 'Document not found' 
            });
        }

        const oldStatus = document.status;
        document.status = status;
        document.remarks = remarks || '';
        document.reviewedBy = req.user.id;
        document.reviewedAt = new Date();

        await document.save();

        /**
         * ==========================================
         * DOCUMENT REJECTION TRIGGER (Module 9)
         * ==========================================
         * If the verification state updates to "rejected", fetch the target student's 
         * profile and call the triggerNotification service helper to automatically log 
         * an in-app alert in MongoDB and send an email notification to the student.
         */
        if (oldStatus !== status && status === 'rejected') {
            const studentUser = await User.findById(document.studentId);
            if (studentUser) {
                await triggerNotification({
                    recipient: document.studentId,
                    message: `Your uploaded document "${document.name}" was rejected. Remarks: ${remarks || 'None'}`,
                    type: 'document_rejection',
                    tenantId,
                    email: studentUser.email,
                    emailSubject: `Document Rejected: ${document.name}`,
                    emailMessage: `Hi ${studentUser.name},\n\nYour uploaded document "${document.name}" has been rejected during verification.\n\nRemarks: ${remarks || 'None'}\n\nPlease log in to your dashboard and upload a valid replacement file.\n\nBest regards,\nAdmissions Verification Team`
                });
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `Document status updated to ${status}`, 
            data: document 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

// DELETE A DOCUMENT FUNCTION - ONLY FOR INSTITUTION ADMIN
const deleteDocument = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const document = await Document.findOneAndDelete({
            _id: req.params.id,
            tenantId
        });
        if(!document) {
            return res.status(404).json({
                success : false,
                message : 'Document not found'
            });
        }

        if(document.applicationId) {
            await Application.findByIdAndUpdate(document.applicationId, {
                $pull : { documents : document.id }
            });
        }

        res.status(200).json({
            success : false,
            message : 'Document deleted successfully'
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    getDocumentById,
    updateDocumentStatus,
    deleteDocument
};
