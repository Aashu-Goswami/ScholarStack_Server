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
        // 1. Create In-App Notification record
        await Notification.create({
            recipient,
            message,
            type: type || 'system_alert',
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
