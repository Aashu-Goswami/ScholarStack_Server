const Document = require('../models/document');
const Application = require('../models/application');
const Institution = require('../models/institution');
const upload = require('../middleware/fileUploadMiddleware').single('file');

// HELPER FUNCTION - RESOLVE TENANT ID FROM SUBDOMAIN
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

// UPLOAD A NEW DOCUMENT - STUDENT ONLY
const uploadDocument = async (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Please upload a file' });
            }

            const { name, type, applicationId } = req.body;
            if (!name || !type || !applicationId) {
                return res.status(400).json({ success: false, message: 'Please provide document name, type, and application ID' });
            }

            const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Unable to resolve institution' });
            }

            // Verify application exists and is pending
            const application = await Application.findOne({
                _id: applicationId,
                tenantId,
                applicantId: req.user.id
            });

            if (!application) {
                return res.status(404).json({ success: false, message: 'Associated application not found' });
            }

            if (application.status !== 'pending' && application.status !== 'draft') {
                return res.status(400).json({ success: false, message: 'Documents can only be modified while application is pending' });
            }

            const document = await Document.create({
                name,
                type,
                fileUrl: `/uploads/documents/${req.file.filename}`,
                status: 'pending',
                studentId: req.user.id,
                applicationId,
                tenantId
            });

            application.documents = application.documents || [];
            application.documents.push(document._id);
            await application.save();

            res.status(201).json({ success: true, message: 'Document uploaded successfully', data: document });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });
};

// GET ALL DOCUMENTS FOR AN APPLICATION
const getDocuments = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Unable to resolve institution' });
        }

        const { applicationId } = req.params;
        const filter = { applicationId, tenantId };

        if (req.user.role === 'student') {
            filter.studentId = req.user.id;
        }

        const documents = await Document.find(filter)
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: documents.length, data: documents });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// UPDATE DOCUMENT STATUS - ADMIN ONLY
const updateDocumentStatus = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Admin not belonging to institution' });
        }

        const { status, remarks } = req.body;
        const VALID_STATUSES = ['approved', 'rejected', 'pending'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const document = await Document.findOne({ _id: req.params.id, tenantId });
        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        document.status = status;
        document.remarks = remarks || '';
        document.reviewedBy = req.user.id;
        document.reviewedAt = new Date();

        await document.save();

        res.status(200).json({ success: true, message: `Document status updated to ${status}`, data: document });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    updateDocumentStatus
};
