// FORM TEMPLATE MODEL

const mongoose = require('mongoose');
const formFieldSchema = require('./formField');

const formTemplateSchema = new mongoose.Schema(
    {
        courseId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Course',
            required : [true, 'Form template must belong to a course']
        },
        tenantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Institution',
            required : [true, 'Form template must belong to an institution']
        },
        session : {
            type : String,
            required : [true, 'Session is required'],
            trim : true,
            default : () => {
                const year = new Date().getFullYear();
                return `${year}-${year + 1}`;
            }
        },
        fields : {
            type : [formFieldSchema],
            required : [true, 'Atleast one field is required'],
            validate : {
                validator : function(v) {
                    return v && v.length > 0;
                }, 
                message : 'At least one field is required'
            }
        },
        isActive : {
            type : Boolean,
            default : true
        },
        createdBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            required : [true, 'Created by user Id is required']
        }
    },
    {
        timestamps: true
    }
);

formTemplateSchema.index({ courseId: 1, session : 1, tenantId: 1 }, { unique: true });
formTemplateSchema.index({ tenantId: 1, createdAt: -1 });
formTemplateSchema.index({ courseId: 1, tenantId: 1 });

formTemplateSchema.pre('save',async  function() {
    if (this.fields && this.fields.length > 0) {
        const fieldIds = this.fields.map(f => f.fieldKey);
        const uniqueFieldIds = new Set(fieldIds);
        
        if (fieldIds.length !== uniqueFieldIds.size) {
            throw new Error('Duplicate fieldId detected. Each field must have a unique fieldId');
        }
    }
});

module.exports = mongoose.model('FormTemplate', formTemplateSchema);
