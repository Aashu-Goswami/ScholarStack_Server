const express = require('express');
const router = express.Router();
const {
    classifyApplication,
    classifyAllApplications,
    getClassifications,
    getClassificationStats,
    filterByClassification,
    getClassificationRules,
    updateClassificationRules,
    getApplicationByClassification
} = require('../controllers/classificationController'); 

const { protect } = require('../middleware/authMiddleware');
const { instAdminOnly } = require('../middleware/roleCheckerMiddleware');

// RULES FOR CLASSIFICATIONS
router.get('/rules', protect, instAdminOnly, getClassificationRules);
router.put('/rules', protect, instAdminOnly, updateClassificationRules);

// BULK ACTIONS ON APPLICATIONS REGARDING CLASSIFICATION
router.post('/classify-all', protect, instAdminOnly, classifyAllApplications);
router.get('/stats', protect, instAdminOnly, getClassificationStats);
router.get('/filter', protect, instAdminOnly, filterByClassification);

// SINGLE APPLICATION CLASSIFICATION
router.post('/:applicationId/classify', protect, instAdminOnly, classifyApplication);

// GET ALL CLASSIFICATIONS
router.get('/', protect, instAdminOnly, getClassifications);

// GET APPLICATIONS BY CLASSIFICATION
router.get('/:classificationId/applications', protect, instAdminOnly, getApplicationByClassification);

module.exports = router;