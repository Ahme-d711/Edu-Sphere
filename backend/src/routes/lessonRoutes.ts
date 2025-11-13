import express from 'express';
import {
  createLesson,
  deleteLesson,
  getLessonsByCourse,
} from '../controllers/lessonController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';
import { uploadSingle } from '../middlewares/uploadImage&Video.js';

const router = express.Router();

/**
 * @route   /api/lessons
 * @desc    Lesson management routes
 */

router
  .post(
    '/',
    protect,
    restrictTo('instructor', 'admin'),
    uploadSingle('video', 'video'),
    createLesson
  );

// 👇 جلب كل الدروس الخاصة بكورس معين
router.get('/course/:courseId', protect, getLessonsByCourse);

// 👇 حذف درس (Soft Delete)
router.delete(
  '/:id',
  protect,
  restrictTo('instructor', 'admin'),
  deleteLesson
);

export default router;
