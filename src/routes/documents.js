const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUploadMiddleware');
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  updateDocumentStatus,
  deleteDocument
} = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const { instAdminOnly, studentOnly } = require('../middleware/roleCheckerMiddleware');

// PUBLIC ROUTE
router.post('/upload', protect, studentOnly, upload.single('file'), uploadDocument);

// SHARED - STUDENT AND INSTITUTION ADMIN
router.get('/:applicationId', protect, getDocuments);
router.get('/single/:id', protect, getDocumentById);

// INSTITUTION ADMIN ONLY
router.put('/:id/status', protect, instAdminOnly, updateDocumentStatus);
router.delete('/:id', protect, instAdminOnly, deleteDocument);

module.exports = router;