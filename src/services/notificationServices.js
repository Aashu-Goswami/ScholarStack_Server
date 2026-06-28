const Notification = require('../models/notification');
const { sendEmail } = require('./emailService');

/**
 * Centrally triggers student notifications across all event types.
 * Saves an in-app notification in MongoDB and sends an email.
 */
const triggerNotification = async ({
    recipient,
    message,
    type,
    tenantId,
    email,
    emailSubject,
    emailMessage
}) => {
    try {
        // Map types to allowed schema enums
        const allowedTypes = ['registration', 'application', 'document', 'status_update', 'admission'];
        let mappedType = 'status_update';
        if (allowedTypes.includes(type)) {
            mappedType = type;
        } else if (type === 'application_submission') {
            mappedType = 'application';
        } else if (type === 'verification_completion') {
            mappedType = 'document';
        } else if (type === 'admission_approval' || type === 'admission_rejection') {
            mappedType = 'admission';
        }

        // 1. Create In-App Notification record
        await Notification.create({
            userId: recipient,
            title: emailSubject || 'ScholarStack Update',
            message,
            type: mappedType,
            tenantId
        });

        // 2. Send email via SMTP if contact email exists
        if (email && emailMessage) {
            await sendEmail({
                email,
                subject: emailSubject || 'ScholarStack Notification',
                message: emailMessage
            });
        }
    } catch (err) {
        console.error('Notification Service Error:', err.message);
    }
};

module.exports = {
    triggerNotification
};
