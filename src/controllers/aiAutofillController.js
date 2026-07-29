// THIS MODULE HANDLES AI-POWERED AUTOFILL — EXTRACTING APPLICATION-FORM
// DATA FROM AN UPLOADED DOCUMENT (MARKSHEET, ID PROOF, CERTIFICATE, ETC.)

const FormTemplate = require('../models/formTemplate');
const { resolveTenantFromSubdomain } = require('../middleware/tenantResolverMiddleware');
const { extractApplicationFields } = require('../services/aiExtractionService');

// AUTOFILL APPLICATION FIELDS FROM AN UPLOADED DOCUMENT — STUDENT ONLY
// POST /api/documents/autofill
// multipart/form-data: file (required), courseId (optional)
const autofillFromDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file to autofill from'
            });
        }

        const tenantId = req.user.tenantId || await resolveTenantFromSubdomain(req);
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to resolve institution'
            });
        }

        // IF A COURSE IS SPECIFIED, TARGET ITS FORM TEMPLATE'S FIELD KEYS
        // SO EXTRACTED DATA CAN BE MERGED STRAIGHT INTO personalDetails.
        // OTHERWISE FALL BACK TO THE GENERIC FIELD SET.
        let templateFields = null;
        const { courseId } = req.body;
        if (courseId) {
            const template = await FormTemplate.findOne({ courseId, tenantId, isActive: true })
                .sort({ createdAt: -1 });
            if (template) {
                templateFields = template.fields;
            }
        }

        const { extractedFields, fieldsAttempted } = await extractApplicationFields(
            req.file.buffer,
            req.file.mimetype,
            templateFields
        );

        if (Object.keys(extractedFields).length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Could not confidently extract any fields from this document. Please fill the form manually.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Fields extracted successfully. Please review before submitting.',
            data: {
                extractedFields,
                fieldsAttempted
            }
        });
    } catch (err) {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = { autofillFromDocument };