// THIS MODULE HANDLES USER NOTIFICATION MANAGEMENT

const Notification = require('../models/notification');

// GET ALL NOTIFICATIONS FOR THE LOGGED-IN USER
const getMyNotifications = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // BUILD FILTER 
        const filter = { userId };
        if (tenantId) {
            filter.tenantId = tenantId;
        }

        // EXECUTE QUERY FOR NOTIFICATIONS
        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Notification.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            page,
            pages : Math.ceil(total / limit),
            data: notifications
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET COUNT OF UNREAD NOTIFICATIONS FOR LOGGED-IN USER
const getUnreadCount = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // BUILD FILTER
        const filter = { userId, isRead : false };
        if(tenantId) {
            filter.tenantId = tenantId;
        }

        const count = await Notification.countDocuments(filter);

        res.status(200).json({
            success : true,
            count
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// MARK A SINGLE NOTIFICATION AS READ
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true, readAt: new Date() },
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
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// MARK ALL NOTIFICATIONS AS READ FOR LOOGED-IN USER
const markAllAsRead = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // BUILD FILTER 
        const filter = { userId, isRead : false};
        if(tenantId) {
            filter.tenantId = tenantId;
        }

        // UPDATE ALL MATCHING NOTIFICATIONS
        const result = await Notification.updateMany(
            filter,
            { isRead : true, readAt : new Date() }
        );

        res.status(200).json({
            success : true,
            message : `Marked ${result.modifiedCount} notifications as read`,
            count : result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

// DELETE A NOTIFICATION
const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id : req.params.id,
            userId : req.user.id
        });

        if(!notification) {
            return res.status(404).json({
                success : false,
                message : 'Notification not found'
            });
        }

        res.status(200).json({
            success : true,
            message : 'Notification deleted successfully'
        });
    } catch (err) {
        if (err.name === 'CastError' || err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        res.status(500).json({
            success : false,
            message : err.message
        });
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
