const express = require('express');
const router = express.Router();
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} = require('../../controllers/courseController');
const { protect } = require('../../middleware/authMiddleware');
const { adminOnly } = require('../../middleware/roleCheckerMiddleware');

// PUBLIC ROUTES
router.get('/', getCourses);
router.get('/:id', getCourseById);

// PROTECTED ROUTES - ADMIN ONLY
router.post('/', protect, adminOnly, createCourse);
router.put('/:id', protect, adminOnly, updateCourse);
router.delete('/:id', protect, adminOnly, deleteCourse);

module.exports = router;