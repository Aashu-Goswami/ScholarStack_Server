const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUploadMiddleware');
const aiUpload = require('../middleware/aiUploadMiddleware');
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  updateDocumentStatus,
  deleteDocument
} = require('../controllers/documentController');
const { autofillFromDocument } = require('../controllers/aiAutofillController');
const { protect } = require('../middleware/authMiddleware');
const { instAdminOnly, studentOnly } = require('../middleware/roleCheckerMiddleware');

// STUDENT ROUTE ONLY 
router.post('/upload', protect, studentOnly, upload.single('file'), uploadDocument);

// AI AUTOFILL - EXTRACT APPLICATION FIELDS FROM AN UPLOADED DOCUMENT - STUDENT ONLY
router.post('/autofill', protect, studentOnly, aiUpload.single('file'), autofillFromDocument);

// SHARED - STUDENT AND INSTITUTION ADMIN
router.get('/single/:id', protect, getDocumentById);
router.get('/:applicationId', protect, getDocuments);

// INSTITUTION ADMIN ONLY
router.put('/:id/status', protect, instAdminOnly, updateDocumentStatus);
router.delete('/:id', protect, instAdminOnly, deleteDocument);

module.exports = router;