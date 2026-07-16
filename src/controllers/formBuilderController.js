// THIS MODULE HANDLES DYNAMIC FORM TEMPLATE MANAGEMENT FOR COURSES

const FormTemplate = require('../models/formTemplate');
const Course = require('../models/course');
const { resolveTenantFromSubdomain } = require('../middleware/tenantResolverMiddleware');

// GET LATEST FORM TEMPLATE FOR A SPECIFIC COURSE - FOR STUDENT 
const getFormTemplateByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const tenantId = await resolveTenantFromSubdomain(req);

        if(!tenantId) {
            return res.status(400).json({
                success : false,
                message : 'Invalid institution subdomain'
            });
        }

        // VERIFY COURSE EXISTS AND BELONGS TO THIS TENANT 
        const course = await Course.findOne({ _id : courseId, tenantId });
        if(!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found for this institution'
            });
        }

        // GET THE LATEST TEMPLATE FOR THIS COURSE 
        const template = await FormTemplate.findOne({ courseId, tenantId }).sort({ createdAt : -1 });
        if(!template) {
            return res.status(404).json({
                success : false,
                message : 'No form template found for this course'
            });
        }

        res.status(200).json({
            success : true,
            data : template
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// CREATE A NEW FORM TEMPLATE FOR A COURSE - ONLY INSTITUTION ADMIN
const createFormTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { courseId, session, fields } = req.body;

        // VALIDATE REQUIRED FIELDS
        if(!courseId || !fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({
                success : false,
                message : 'Please provide at least one form field'
            });
        }

        // VERIFY COURSE EXISTS AND BELONGS TO THIS TENANT
        const course = await Course.findOne({ _id : courseId, tenantId : tenantId });
        if(!course) {
            return res.status(404).json({
                success : false,
                message : 'Course not found for your institution'
            });
        }

        // PREVENT DUPLICATE TEMPLATE - ONE PER COURSE PER TENANT
        const existingTemplate = await FormTemplate.findOne({ courseId, tenantId });
        if(existingTemplate) {
            return res.status(400).json({
                success : false,
                message : 'Form template already exists for this course. Use update instead'
            });
        }

        // VALIDATE EACH FIELD HAS REQUIRED PROPERTIES
        const validTypes = ['text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'file'];
        for(let field of fields) {
            if(!field.label || !field.fieldKey || !field.type) {
                return res.status(400).json({
                    success : false,
                    message : 'Each field must have a label, fieldKey, and type'
                });
            }
            if(!validTypes.includes(field.type)) {
                return res.status(400).json({
                    success : false,
                    message : `Invalid field type: ${field.type}`
                });
            }
            if(['dropdown', 'radio', 'checkbox'].includes(field.type) && (!field.options || !Array.isArray(field.options) || field.options.length === 0)) {
                return res.status(400).json({
                    success : false,
                    message : `Field '${field.label}' of type '${field.type}' requires options`
                });
            }
        }

        // AUTO-GENERATE SESSION IF NOT PROVIDED
        const sessionValue = session || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);

        // CREATE NEW FORM TEMPLATE
        const formTemplate = await FormTemplate.create({
            courseId,
            tenantId,
            fields,
            session : sessionValue,
            createdBy : req.user.id
        });

        res.status(201).json({
            success : true,
            message : 'Form template created successfully',
            data : formTemplate
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET ALL FORM TEMPLATES FUNCTION - FOR INSTITUTION ADMIN
const getFormTemplates = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const templates = await FormTemplate.find({ tenantId })
            .populate('courseId', 'name')
            .sort({ createdAt : -1 });

        res.status(200).json({
            success : true,
            count : templates.length,
            data : templates
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// GET A SINGLE FORM TEMPLATE BY ID - FOR INSITUTION ADMIN 
const getFormTemplateById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any Institution'
            });
        }

        const template = await FormTemplate.findOne({
            _id : req.params.id,
            tenantId
        }).populate('courseId', 'name session');

        if(!template) {
            return res.status(404).json({
                success : false,
                message : 'Form template not found'
            });
        }

        res.status(200).json({
            success : true,
            data : template
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Form template not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// UPDATE FORM TEMPLATE FIELDS - ONLY INSTITUTION ADMIN, WITHIN TENANT
const updateFormTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        // FIND TEMPLATE WITHIN TENANT
        const formTemplate = await FormTemplate.findOne({ _id : req.params.id, tenantId });
        if(!formTemplate) {
            return res.status(404).json({
                success : false,
                message : 'Form template not found for this course'
            });
        }

        const { fields, isActive } = req.body;

        // VALIDATE FIELDS IF PROVIDED
        if(fields) {
            if(!Array.isArray(fields) || fields.length === 0) {
                return res.status(400).json({
                    success : false,
                    message : 'Please provide at least one form field'
                });
            }

            const validTypes = ['text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'file'];
            for(let field of fields) {
                if(!field.label || !field.fieldKey || !field.type) {
                    return res.status(400).json({
                        success : false,
                        message : 'Each field must have a label, fieldKey, and type'
                    });
                }
                if(!validTypes.includes(field.type)) {
                    return res.status(400).json({
                        success : false,
                        message : `Invalid field type: ${field.type}`
                    });
                }
                if(['dropdown', 'radio', 'checkbox'].includes(field.type) && (!field.options || field.options.length === 0)) {
                    return res.status(400).json({
                        success : false,
                        message : `Field '${field.label}' of type '${field.type}' requires options`
                    });
                }
            }
            formTemplate.fields = fields;
        }

        // UPDATE ACTIVE STATUS IF PROVIDED
        if(typeof isActive === 'boolean') formTemplate.isActive = isActive;

        await formTemplate.save();

        res.status(200).json({
            success : true,
            message : 'Form template updated successfully',
            data : formTemplate
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Form template not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// DELETE FORM TEMPLATE - ONLY INSTITUTION ADMIN, WITHIN TENANT
const deleteFormTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        // FIND AND DELETE TEMPLATE
        const formTemplate = await FormTemplate.findOneAndDelete({ _id : req.params.id, tenantId });
        if(!formTemplate) {
            return res.status(404).json({
                success : false,
                message : 'Form template not found for this course'
            });
        }

        res.status(200).json({
            success : true,
            message : 'Form template deleted successfully'
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Form template not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    getFormTemplateByCourse, 
    createFormTemplate,
    getFormTemplates,
    getFormTemplateById,
    updateFormTemplate,
    deleteFormTemplate
};
