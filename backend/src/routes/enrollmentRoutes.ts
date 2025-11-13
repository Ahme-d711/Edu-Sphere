import express from 'express';
import {
  enrollInCourse,
  getMyEnrollments,
  getAllEnrollments,
  cancelEnrollment,
  updateProgress,
} from '../controllers/enrollmentController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';

const router = express.Router();

router
  .route('/:courseId')
  .post(protect, restrictTo('student'), enrollInCourse);

router
  .route('/my')
  .get(protect, restrictTo('student'), getMyEnrollments);

router
  .route('/')
  .get(protect, restrictTo('admin'), getAllEnrollments);

router
  .route('/:id')
  .delete(protect, cancelEnrollment);

router
  .patch('/:id/progress', protect, restrictTo('student'), updateProgress);

export default router;
