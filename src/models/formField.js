// FORM FIELD MODEL - THIS IS EMBEDDED INSIDE FormTemplate.fields[], NOT A STANDALONE COLLECTION

const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema(
    {
        label : {
            type : String,
            required : [true, 'Please add a field label'],
            trim : true,
            maxlength : [50, 'Label cannot exceed 50 characters']
        },
        fieldKey: {
            type: String,
            required: [true, 'Please add a field key'],
            trim: true,
            match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'fieldKey must contain only letter, numbers and underscores' ]
        },
        type : {
            type : String,
            enum : ['text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'file'],
            required : [true, 'Please specify field type']
        },
        validation : {
            type : {
                required : {
                    type : Boolean,
                    default : false
                },
                min : {
                    type : Number,
                    min : 0
                },
                max : {
                    type : Number,
                    min : 0
                },
                fileSize : {
                    type : Number,
                    min : 0
                },
                fileTypes : {
                    type : [String],
                    default : []
                }
            },
            default : {}
        },
        options: {
            type : [String],
            default : [],
            validate : {
                validator : function(v) {
                    if(['dropdown', 'radio', 'checkbox'].includes(this.type)) {
                        return v && v.length > 0;
                    }
                    return true;
                },
                message : 'Options are required for dropdown, radio and checkbox fields'
            }
        },
        order: {
            type: Number,
            default: 0
        },
        conditional : {
            dependsOn : {
                type : String,
                trim : true
            },
            showIf : {
                operator : {
                    type : String,
                    enum : ['>=', '<=', '>', '<', '==', '!='],
                    default : '>='
                },
                value : {
                    type : mongoose.Schema.Types.Mixed
                }
            }
        }
    },
    {
        _id: true
    }
);

module.exports = formFieldSchema;
