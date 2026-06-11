const express = require('express');
const router = express.Router();
const {
  createInstitution,
  getInstitution,
  updateInstitution,
  deleteInstitution
} = require('../../controllers/institutionController');
const { protect } = require('../../middleware/authMiddleware');
const { superAdminOnly } = require('../../middleware/roleCheckerMiddleware');

// PROTECTED ROUTES - SUPER ADMIN ONLY
router.post('/', protect, superAdminOnly, createInstitution);
router.get('/:id', protect, getInstitution);
router.put('/:id', protect, superAdminOnly, updateInstitution);
router.delete('/:id', protect, superAdminOnly, deleteInstitution);

module.exports = router;