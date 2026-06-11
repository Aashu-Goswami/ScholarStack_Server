const express = require('express');
const router = express.Router();
const {
  submitApplication,
  saveDraft,
  getMyApplication,
  getAllApplications,
  updateApplicationStatus,
  filterApplications
} = require('../../controllers/applicationController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly, studentOnly } = require('../../middleware/roleCheckerMiddleware');

// STUDENT ROUTES
router.post('/', protect, studentOnly, submitApplication);
router.put('/:id/draft', protect, studentOnly, saveDraft);
router.get('/my', protect, studentOnly, getMyApplication);

// ADMIN ROUTES
router.get('/admin/all', protect, adminOnly, getAllApplications);
router.put('/admin/:id', protect, adminOnly, updateApplicationStatus);
router.get('/admin/filter', protect, adminOnly, filterApplications);

module.exports = router;
