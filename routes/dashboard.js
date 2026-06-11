const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getStatsByCourse,
  getStudentDashboard
} = require('../../controllers/dashboardController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly, studentOnly } = require('../../middleware/roleCheckerMiddleware');

// ADMIN ROUTES
router.get('/admin', protect, adminOnly, getAdminDashboard);
router.get('/admin/stats/by-course', protect, adminOnly, getStatsByCourse);

// STUDENT ROUTES
router.get('/student', protect, studentOnly, getStudentDashboard);

module.exports = router;