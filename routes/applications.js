const express = require('express');
const router = express.Router();
const { submitApplication, saveDraft, getMyApplication, getAllApplications, updateApplicationStatus, filterApplications } = require('../controllers/application.controller');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

router.post('/', verifyToken, authorizeRole('student'), submitApplication);
router.put('/:id/draft', verifyToken, authorizeRole('student'), saveDraft);
router.get('/my', verifyToken, authorizeRole('student'), getMyApplication);
router.get('/admin/all', verifyToken, authorizeRole('admin'), getAllApplications);
router.put('/admin/:id', verifyToken, authorizeRole('admin'), updateApplicationStatus);
router.get('/admin/filter', verifyToken, authorizeRole('admin'), filterApplications);

module.exports = router;