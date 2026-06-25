const express = require('express');
const router = express.Router();
const {
  createFormTemplate,
  getFormTemplates,
  getFormTemplateById,
  getFormTemplateByCourse,
  updateFormTemplate,
  deleteFormTemplate
} = require('../../controllers/formBuilderController');
const { protect } = require('../../middleware/authMiddleware');
const { instAdminOnly } = require('../../middleware/roleCheckerMiddleware');

router.get('/course/:courseId', getFormTemplateByCourse);

// PROTECTED ROUTES - ADMIN ONLY
router.get('/', protect, instAdminOnly, getFormTemplates);
router.get('/:id', protect, instAdminOnly, getFormTemplateById);
router.post('/', protect, instAdminOnly, createFormTemplate);
router.put('/:id', protect, instAdminOnly, updateFormTemplate);
router.delete('/:id', protect, instAdminOnly, deleteFormTemplate);

module.exports = router;
