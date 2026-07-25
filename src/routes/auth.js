const express = require('express');
const router = express.Router();
const {
    registerStudent,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    changePassword,
    registerInstitutionAdmin,
    addInstitutionAdmin,
    getAdmins
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');
const { superAdminOnly, instAdminOnly } = require('../middleware/roleCheckerMiddleware');

// PUBLIC ROUTES
router.post('/register/student', registerStudent);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);

// PROTECTED ROUTES - ONLY FOR AUTHENTICATED USERS
router.post('/change-password', protect, changePassword);

// CREATE FIRST INSTITUTION ADMIN - ONLY FOR SUPER ADMIN
router.post('/register/admin', protect, superAdminOnly, registerInstitutionAdmin);

// CREATE ADDITIONAL INSTITUTION ADMIN - ONLY INSTITUTION ADMIN
router.post('/add-admin', protect, instAdminOnly, addInstitutionAdmin);
router.get('/admins', protect, instAdminOnly, getAdmins);

module.exports = router;
