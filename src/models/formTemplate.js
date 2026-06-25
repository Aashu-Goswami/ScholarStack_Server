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
            required : true,
            trim : true,
            default : () => {
                const year = new Date().getFullYear();
                return `${year}-${year + 1}`;
            }
        },
        fields : {
            type : [formFieldSchema],
            required : true,
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
            required : true
        }
    },
    {
        timestamps: true
    }
);

// One active form template per course per tenant
formTemplateSchema.index({ courseId: 1, session : 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('FormTemplate', formTemplateSchema);
