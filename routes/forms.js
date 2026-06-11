const express = require('express');
const router = express.Router();
const {
  createForm,
  getFormByCourse,
  updateForm
} = require('../../controllers/formController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly } = require('../../middleware/roleCheckerMiddleware');

// PUBLIC ROUTES
router.get('/:courseId', getFormByCourse);

// PROTECTED ROUTES - ADMIN ONLY
router.post('/:courseId', protect, adminOnly, createForm);
router.put('/:courseId', protect, adminOnly, updateForm);

module.exports = router;