const FormTemplate = require('../models/formTemplate');
const Course = require('../models/course');

// CREATE OR SAVE FORM TEMPLATE FOR A COURSE - ONLY INSTITUTION ADMIN
const createFormTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'Admin does not belong to any institution'
            });
        }

        const { courseId } = req.params;
        const { fields } = req.body;

        if(!fields || !Array.isArray(fields) || fields.length === 0) {
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
        for(const field of fields) {
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

        // CREATE NEW FORM TEMPLATE
        const formTemplate = await FormTemplate.create({
            courseId,
            tenantId,
            fields,
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

// GET FORM TEMPLATE FOR A COURSE - STUDENT FETCHES FORM CONFIG, WITHIN TENANT
const getFormTemplate = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        if(!tenantId) {
            return res.status(403).json({
                success : false,
                message : 'User does not belong to any institution'
            });
        }

        const { courseId } = req.params;

        const formTemplate = await FormTemplate.findOne({ courseId, tenantId, isActive : true });
        if(!formTemplate) {
            return res.status(404).json({
                success : false,
                message : 'Form template not found for this course'
            });
        }

        res.status(200).json({
            success : true,
            data : formTemplate
        });
    } catch (err) {
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

        const { courseId } = req.params;

        const formTemplate = await FormTemplate.findOne({ courseId, tenantId });
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
            for(const field of fields) {
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

        if(typeof isActive === 'boolean') formTemplate.isActive = isActive;

        await formTemplate.save();

        res.status(200).json({
            success : true,
            message : 'Form template updated successfully',
            data : formTemplate
        });
    } catch (err) {
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

        const { courseId } = req.params;

        const formTemplate = await FormTemplate.findOneAndDelete({ courseId, tenantId });
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
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    createFormTemplate,
    getFormTemplate,
    updateFormTemplate,
    deleteFormTemplate
};
