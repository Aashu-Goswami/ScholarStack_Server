const Notification = require('../models/notification');
const { sendEmail } = require('./emailService');

/**
 * Centrally triggers student notifications across all event types.
 * Saves an in-app notification in MongoDB and sends an email.
 */

const TYPE_MAPPING = {
    // REGISTRATION
    registration: 'registration_success',
    registration_success: 'registration_success',

    // APPLICATION
    application_submitted: 'application_submitted',
    application: 'application_submitted',
    application_submission: 'application_submitted',

    // DOCUMENTS
    document_approved: 'document_approved',
    document_rejected: 'document_rejected',
    document: 'document_approved', 
    verification_completed: 'verification_completed',

    // STATUS UPDATES
    status_updated: 'status_updated',
    status_update: 'status_updated',

    // ADMISSION
    admission_approved: 'admission_approved',
    admission_rejected: 'admission_rejected',
    admission: 'admission_approved', 
    admission_approval: 'admission_approved',
    admission_rejection: 'admission_rejected'
};

const getTitleForType = (type) => {
    const titles = {
        registration_success: 'Registration Successful',
        application_submitted: 'Application Submitted',
        document_approved: 'Document Approved',
        document_rejected: 'Document Rejected',
        status_updated: 'Status Updated',
        verification_completed: 'Verification Completed',
        admission_approved: 'Admission Approved',
        admission_rejected: 'Admission Rejected'
    };
    return titles[type] || 'ScholarStack Update';
};

const triggerNotification = async ({
    userId,
    tenantId,
    type,
    title,
    message,
    email,
    emailSubject,
    emailMessage,
    metadata = {},
    sourceId = null,
    sourceModel = null
}) => {
    try {
        if(!userId) { throw new Error('userId is required for notification'); }
        if(!tenantId) { throw new Error('tenantId is required for notification'); }
        if(!type) { throw new Error('notification type is required'); }
        if(!message) { throw new Error('notification message is required'); }

        let mappedType = TYPE_MAPPING[type] || 'status_updated';
        const notificationTitle = title || getTitleForType(mappedType);

        const notification = await Notification.create({
            userId,
            tenantId,
            type : mappedType,
            title : notificationTitle,
            message : message.trim(),
            isRead : false,
            readAt : null,
            metadata,
            sourceId,
            sourceModel
        });

        let emailSent = false;
        if(email && emailMessage) {
            try {
                await sendEmail({
                    email,
                    subject : emailSubject || notificationTitle,
                    message : emailMessage
                });
                emailSent = true;

                await Notification.findByIdAndUpdate(notification._id, {
                    emailSent : true,
                    emailSentAt : new Date()
                });
            } catch (emailError) {
                console.error('Email sending failed : ', emailError.message);
            }
        }

        return {
            success : true,
            data : notification,
            emailSent
        };
    } catch (err) {
        console.error('Notification Service Error:', err.message);
        return {
            success : false,
            error : err.message
        };
    }
};

module.exports = { triggerNotification };
