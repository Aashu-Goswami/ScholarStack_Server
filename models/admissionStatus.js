const mongoose = require('mongoose');

const admissionStatusSchema = new mongoose.Schema(
    {
        applicationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Application',
            required: true
        },
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: true
        },
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        classification: {
            type: String,
            enum: ['eligible', 'not_eligible', 'high_merit', 'reserved_category', 'pending_verification'],
            default: 'pending_verification'
        },
        remarks: {
            type: String,
            default: ''
        },
        classifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        classifiedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

admissionStatusSchema.index({ applicationId: 1 }, { unique: true });

module.exports = mongoose.model('AdmissionStatus', admissionStatusSchema);
