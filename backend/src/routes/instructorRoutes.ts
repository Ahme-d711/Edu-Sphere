import { Router } from 'express';
import {
  getAllInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  getInstructorCourses,
  getUserInstructorCourses,
  deleteInstructor,
  restoreInstructor,
} from '../controllers/instructorController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';

const router = Router();

router.route('/')
  .get(getAllInstructors)
  .post(protect, restrictTo('admin'), createInstructor);

router.get('/my-courses',protect, restrictTo('instructor'), getInstructorCourses);
router.get('/instructor-courses/:id', protect, getUserInstructorCourses);

router.route('/:id')
  .get(getInstructor)
  .patch(protect, restrictTo('admin', 'instructor'), updateInstructor)
  .delete(protect, restrictTo('admin'), deleteInstructor);

router.patch("/:id/restore", protect, restrictTo("admin"), restoreInstructor)

export default router;
