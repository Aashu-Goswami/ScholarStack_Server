const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        title: {
            type: String,
            required: [true, 'Please add notification title'],
            trim: true
        },
        message: {
            type: String,
            required: [true, 'Please add notification message']
        },
        type: {
            type: String,
            enum: ['registration', 'application', 'document', 'status_update', 'admission'],
            default: 'status_update'
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
