const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  getDocuments,
  updateDocumentStatus
} = require('../../controllers/documentController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly, studentOnly } = require('../../middleware/roleCheckerMiddleware');

// STUDENT ROUTES
router.post('/upload', protect, studentOnly, uploadDocument);

// SHARED - STUDENT AND ADMIN
router.get('/:applicationId', protect, getDocuments);

// ADMIN ONLY
router.put('/:id/status', protect, adminOnly, updateDocumentStatus);

module.exports = router;