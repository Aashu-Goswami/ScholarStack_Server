const express = require('express');
const router = express.Router();
const {
  createOrGetDraft,
  submitApplication,
  saveDraft,
  getMyApplication,
  getAllApplications,
  updateApplicationStatus,
  filterApplications,
  getApplicationById,
  deleteApplication,
  getApplicationTimeline,
  getWorkflowStatuses,
  generateApplicationMessage
} = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');
const { instAdminOnly, studentOnly } = require('../middleware/roleCheckerMiddleware');

router.get('/workflow/statuses', protect, getWorkflowStatuses);

// ADMIN ROUTES
router.get('/admin/all', protect, instAdminOnly, getAllApplications);
router.put('/admin/:id', protect, instAdminOnly, updateApplicationStatus);
router.post('/:id/generate-message', protect, instAdminOnly, generateApplicationMessage);
router.get('/admin/filter', protect, instAdminOnly, filterApplications);

// STUDENT ROUTES
router.post('/draft', protect, studentOnly, createOrGetDraft);
router.post('/', protect, studentOnly, submitApplication);
router.put('/:id/draft', protect, studentOnly, saveDraft);
router.get('/my', protect, studentOnly, getMyApplication);

// SHARED ROUTES
router.get('/:id/timeline', protect, getApplicationTimeline);
router.get('/:id', protect, getApplicationById);
router.delete('/:id', protect, instAdminOnly, deleteApplication);

module.exports = router;
