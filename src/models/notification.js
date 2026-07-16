// NOTIFICATION MODEL

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: [true, 'Tenant ID is required'],
            index : true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index : true
        },
        title: {
            type: String,
            required: [true, 'Please add notification title'],
            trim: true,
            maxlength : [50, 'Title cannot exceed 50 characters']
        },
        message: {
            type: String,
            required: [true, 'Please add notification message'],
            trim : true,
            maxlength : [250, 'Message cannot exceed 250 characters']
        },
        type: {
            type: String,
            enum: ['registration_success', 'application_submitted', 'document_approved', 'document_rejected', 'status_updated', 'verification_completed', 'admission_approved', 'admission_rejected'],
            default: 'status_updated',
            required : [true, 'Notification type is required']
        },
        isRead: {
            type: Boolean,
            default: false,
            index : true
        },
        readAt : {
            type : Date,
            default : null
        },
        sourceId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'sourceModel',
            default: null
        },
        sourceModel: {
            type: String,
            enum: ['Application', 'Document', 'User'],
            default: null
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        emailSent: {
            type: Boolean,
            default: false
        },
        emailSentAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ sourceId: 1, sourceModel: 1 });

notificationSchema.pre('save', async function() {
    if (this.isModified('isRead')) {
        if (this.isRead === true && !this.readAt) {
            this.readAt = new Date();
        }
        if (this.isRead === false) {
            this.readAt = null;
        }
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
