const express = require('express');
const router = express.Router();
const {
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution
} = require('../controllers/institutionController');
const { protect } = require('../middleware/authMiddleware');
const { superAdminOnly, superAdminOrOwnInstitution } = require('../middleware/roleCheckerMiddleware');

router.get('/public', getPublicInstitutions);

// PROTECTED ROUTES - SUPER ADMIN ONLY
router.get('/', protect, superAdminOnly, getInstitutions);
router.post('/', protect, superAdminOnly, createInstitution);
router.delete('/:id', protect, superAdminOnly, deleteInstitution);

// PROTECTED ROUTES - FOR BOTH SUPER ADMIN AND INSTITUTION ADMINS
router.get('/:id', protect, superAdminOrOwnInstitution, getInstitutionById);
router.put('/:id', protect, superAdminOrOwnInstitution, updateInstitution);

module.exports = router;