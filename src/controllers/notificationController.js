const Notification = require('../models/notification');

// GET STUDENT IN-APP NOTIFICATIONS
const getMyNotifications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const filter = { userId: req.user.id };

        if (tenantId) {
            filter.tenantId = tenantId;
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// MARK NOTIFICATION AS READ
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found or access denied'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead
};
