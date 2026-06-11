const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markAsRead
} = require('../../controllers/notificationController');
const { protect } = require('../../middleware/authMiddleware');

// PROTECTED ROUTES - AUTHENTICATED USERS
router.get('/my', protect, getMyNotifications);
router.put('/:id/read', protect, markAsRead);

module.exports = router;