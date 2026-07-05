const express = require('express');
const router = express.Router();
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} = require('../controllers/courseController');
const { protect } = require('../middleware/authMiddleware');
const { instAdminOnly } = require('../middleware/roleCheckerMiddleware');

// PUBLIC ROUTES
router.get('/', getCourses);
router.get('/:id', getCourseById);

// PROTECTED ROUTES - ADMIN ONLY
router.post('/', protect, instAdminOnly, createCourse);
router.put('/:id', protect, instAdminOnly, updateCourse);
router.delete('/:id', protect, instAdminOnly, deleteCourse);

module.exports = router;