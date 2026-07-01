const express = require('express');
const router = express.Router();
const {
  submitApplication,
  saveDraft,
  getMyApplication,
  getAllApplications,
  updateApplicationStatus,
  filterApplications,
  getApplicationById,
  deleteApplication,
  getApplicationTimeline,
  getWorkflowStatuses
} = require('../../controllers/applicationController');
const { protect } = require('../../middleware/authMiddleware');
const { instAdminOnly, studentOnly } = require('../../middleware/roleCheckerMiddleware');

router.get('./workflow/statuses', protect, getWorkFlowStatuses);
router.get('./:id/timeline', protect, getApplicationTimeline);

// PUBLIC ROUTES
router.post('/', protect, studentOnly, submitApplication);
router.put('/:id/draft', protect, studentOnly, saveDraft);
router.get('/my', protect, studentOnly, getMyApplication);
router.get('/:id', protect, getApplicationById);

// ADMIN ROUTES
router.get('/admin/all', protect, instAdminOnly, getAllApplications);
router.put('/admin/:id', protect, instAdminOnly, updateApplicationStatus);
router.get('/admin/filter', protect, instAdminOnly, filterApplications);
router.delete('/:id', protect, instAdminOnly, deleteApplication);

module.exports = router;
