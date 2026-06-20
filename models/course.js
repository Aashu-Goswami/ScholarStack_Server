const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a course name'],
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: [true, 'Course must belong to an institution (tenant)']
        },
        eligibilityCriteria: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        admissionCapacity: {
            type: Number,
            default: 0
        },
        requiredDocuments: {
            type: [String],
            default: []
        },
        session: {
            type: String,
            default: ''
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Compound index to ensure course name is unique per institution (tenant)
courseSchema.index({ name: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('Course', courseSchema);
