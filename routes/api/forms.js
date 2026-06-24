const express = require('express');
const router = express.Router();
const {
  createFormTemplate,
  getFormTemplate,
  updateFormTemplate,
  deleteFormTemplate
} = require('../../controllers/formBuilderController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly } = require('../../middleware/roleCheckerMiddleware');

// PROTECTED ROUTE - ANY AUTHENTICATED USER WITHIN TENANT (STUDENT FETCHES FORM CONFIG)
router.get('/:courseId', protect, getFormTemplate);

// PROTECTED ROUTES - ADMIN ONLY
router.post('/:courseId', protect, adminOnly, createFormTemplate);
router.put('/:courseId', protect, adminOnly, updateFormTemplate);
router.delete('/:courseId', protect, adminOnly, deleteFormTemplate);

module.exports = router;
