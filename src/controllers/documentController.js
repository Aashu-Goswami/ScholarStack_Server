// THIS MODULE HANDLES DOCUMENT UPLOAD, RETRIEVAL, VERIFICATION AND DELETION

const Document = require('../models/document');
const Application = require('../models/application');
const User = require('../models/user');
const { triggerNotification } = require('../services/notificationServices');
const { resolveTenantFromSubdomain } = require('../middleware/tenantResolverMiddleware');

// UPLOAD A DOCUMENT FOR A STUDENT'S APPLICATION - STUDENT ONLY
const uploadDocument = async (req, res) => {
    try {
        // CHECK IF FILE WAS UPLOADED
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload a file' 
            });
        }

        // VALIDATE REQUIRED FIELDS
        const { name, type, applicationId } = req.body;
        if (!name || !type || !applicationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide document name, type, and application ID' 
            });
        }

        // RESOLVE TENANT
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Unable to resolve institution' 
            });
        }

        // VERIFY APPLICATION EXISTS AND BELONGS TO THIS STUDENT
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

        // ALLOW DOCUMENT UPLOAD FOR DRAFT APPLICATIONS ONLY
        if (application.status !== 'draft') {
            return res.status(400).json({ 
                success: false, 
                message: 'Documents can only be modified while application is pending or draft' 
            });
        }

        // CREATE DOCUMENT RECORD IN DATABASE
        const document = await Document.create({
            name,
            type,
            fileUrl: `/uploads/documents/${req.file.filename}`,
            status: 'under review',
            applicantId: req.user.id,
            applicationId,
            tenantId
        });

        // APPEND DOCUMENT REFERENCE TO APPLICATION
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

// GET ALL DOCUMENTS FOR A SPECIFIC APPLICATION
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

        // ENFORCE ACCESS CONTROL - STUDENT CAN VIEW ONLY THIER DOCUMENTS
        if (req.user.role === 'student') {
            const application = await Application.findOne({
                _id: applicationId,
                tenantId,
                applicantId: req.user.id
            });

            if (!application) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied. You can only view documents for your own applications.' 
                });
            }

            const documents = await Document.find({
                applicationId,
                tenantId,
                applicantId: req.user.id
            })
                .populate('reviewedBy', 'name email')
                .sort({ createdAt: -1 });

            return res.status(200).json({ 
                success: true, 
                count: documents.length, 
                data: documents 
            });
        }

        // ADMIN CAN FETCH ALL DOCUMENTS FOR THE APPLICATIONS
        const documents = await Document.find({ applicationId, tenantId })
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: documents.length,
            data: documents
        });
    } catch (err) {
         if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

// GET A SINGLE DOCUMENT BY ID - FOR BOTH STUDENT AND INSTITUTION ADMIN
const getDocumentById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to resolve institution'
            });
        }

        const { id } = req.params;

        // STUDENT CAN ONLY VIEW THEIR OWN DOCUMENTS
        if (req.user.role === 'student') {
            const document = await Document.findOne({
                _id: id,
                tenantId,
                applicantId: req.user.id
            }).populate('reviewedBy', 'name email');

            if (!document) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only view your own documents.'
                });
            }

            return res.status(200).json({ 
                success: true, 
                data: document 
            });
        }

        // ADMIN FETCH ANY DOCUMENT IN TENANT
        const document = await Document.findOne({ _id: id, tenantId})
            .populate('reviewedBy', 'name email');

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.status(200).json({
            success: true,
            data: document
        });
    } catch (err) {
         if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// UPDATE DOCUMENT VERIFICATION STATUS - ADMIN ONLY
const updateDocumentStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin does not belong to any institution' 
            });
        }

        const { status, remarks } = req.body;
        const VALID_STATUSES = ['approved', 'rejected', 'under review'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        // RETRIEVE DOCUMENT BELONGING STRICTLY TO THE ADMIN'S TENANT
        const document = await Document.findOne({ _id: req.params.id, tenantId });
        if (!document) {
            return res.status(404).json({ 
                success: false, 
                message: 'Document not found' 
            });
        }

        const oldStatus = document.status;

        // UPDATE DOCUMENT STATUS 
        document.status = status;
        document.remarks = remarks || '';
        document.reviewedBy = req.user.id;
        document.reviewedAt = new Date();

        await document.save();

        const studentUser = await User.findById(document.applicantId);

        // DOCUMENT REJECTION TRIGGER
        if (oldStatus !== status && status === 'rejected') {
            if (studentUser) {
                await triggerNotification({
                    userId: document.applicantId,
                    tenantId: tenantId,
                    type: 'document_rejected',
                    title: 'Document Rejected',
                    message: `Your uploaded document "${document.name}" was rejected. Remarks: ${remarks || 'None'}`,
                    email: studentUser.email,
                    emailSubject: `Document Rejected: ${document.name}`,
                    emailMessage: `Hi ${studentUser.name},\n\nYour uploaded document "${document.name}" has been rejected during verification.\n\nRemarks: ${remarks || 'None'}\n\nPlease log in to your dashboard and upload a valid replacement file.\n\nBest regards,\nAdmissions Verification Team`,
                    metadata: {
                        documentId: document._id,
                        documentName: document.name,
                        documentType: document.type,
                        applicationId: document.applicationId
                    },
                    sourceId: document._id,
                    sourceModel: 'Document'
                });
            }
        }

        // DOCUMENT APPROVED TRIGGER
        if (oldStatus !== status && status === 'approved') {
            if (studentUser) {
                await triggerNotification({
                    userId: document.applicantId,
                    tenantId: tenantId,
                    type: 'document_approved',
                    title: 'Document Approved',
                    message: `Your uploaded document "${document.name}" has been approved.`,
                    email: studentUser.email,
                    emailSubject: `Document Approved: ${document.name}`,
                    emailMessage: `Hi ${studentUser.name},\n\nYour uploaded document "${document.name}" has been verified and approved.\n\nContinue with your application process.\n\nBest regards,\nAdmissions Verification Team`,
                    metadata: {
                        documentId: document._id,
                        documentName: document.name,
                        documentType: document.type,
                        applicationId: document.applicationId
                    },
                    sourceId: document._id,
                    sourceModel: 'Document'
                });
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `Document status updated to ${status}`, 
            data: document 
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }
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
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Admin does not belong to any institution'
            });
        }

        // FIND AND DELETE DOCUMENT 
        const document = await Document.findOneAndDelete({
            _id: req.params.id,
            tenantId
        });
        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        // REMOVE DOCUMENT REFERENCE FROM APPLICATION
        if (document.applicationId) {
            await Application.findByIdAndUpdate(document.applicationId, {
                $pull: { documents: document._id }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Document deleted successfully'
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }
        res.status(500).json({
            success: false,
            message: err.message
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
