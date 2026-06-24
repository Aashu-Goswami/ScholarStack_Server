const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add institution name'],
            trim: true
        },
        subdomain: {
            type: String,
            required: [true, 'Please add a subdomain'],
            unique: true,
            lowercase: true,
            trim: true
        },
        logo: {
            type: String,
            default: ''
        },
        contactEmail: {
            type: String,
            default: ''
        },
        contactPhone: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        website: {
            type: String,
            default: ''
        },
        admissionSession: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Institution', institutionSchema);
