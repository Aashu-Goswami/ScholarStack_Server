const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: [true, 'Application must belong to an institution']
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Application must be for a course']
        },
        applicantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Application must belong to a student']
        },
        personalDetails: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        documents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Document'
            }
        ],
        session: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: ['draft', 'pending', 'under_review', 'verified', 'admitted', 'rejected'],
            default: 'draft'
        },
        remarks: {
            type: String,
            default: ''
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// One student can apply once per course per tenant
applicationSchema.index({ tenantId: 1, courseId: 1, applicantId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
