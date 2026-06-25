const mongoose = require('mongoose');

// FormField is embedded inside FormTemplate.fields[] - not a standalone collection
const formFieldSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: [true, 'Please add a field label'],
            trim: true
        },
        fieldKey: {
            type: String,
            required: [true, 'Please add a field key'],
            trim: true
        },
        type: {
            type: String,
            enum: ['text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'file'],
            required: [true, 'Please specify field type']
        },
        required: {
            type: Boolean,
            default: false
        },
        options: {
            type: [String],
            default: []
        },
        order: {
            type: Number,
            default: 0
        }
    },
    {
        _id: true
    }
);

module.exports = formFieldSchema;
