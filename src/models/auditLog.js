const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            default: null
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        action: {
            type: String,
            required: [true, 'Please specify action'],
            trim: true
        },
        targetModel: {
            type: String,
            trim: true,
            default: ''
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
