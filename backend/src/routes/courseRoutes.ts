import express from 'express';
import {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  restoreCourse,
  updateCourseStatus,
} from '../controllers/courseController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';

const router = express.Router();

// 🟢 Public Routes
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

// 🔒 Protected Routes (Instructor / Admin)
router.use(protect); // كل اللي تحت لازم يكون logged in


router.post('/', restrictTo('instructor'), createCourse);

router
  .route('/:id')
  .patch(restrictTo('instructor', 'admin'), updateCourse)
  .delete(restrictTo('instructor', 'admin'), deleteCourse);

router.patch('/:id/restore', restrictTo('admin', 'instructor'), restoreCourse);

router.patch('/:id/status', restrictTo('instructor', 'admin'), updateCourseStatus);

export default router;
