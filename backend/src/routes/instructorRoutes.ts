import { Router } from 'express';
import {
  getAllInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
} from '../controllers/instructorController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';

const router = Router();

router.route('/')
  .get(getAllInstructors)
  .post(protect, restrictTo('admin'), createInstructor);

router.route('/:id')
  .get(getInstructor)
  .patch(protect, restrictTo('admin', 'instructor'), updateInstructor)
  // .delete(protect, restrictTo('admin'), deleteInstructor);
  

  // router
  // .patch('/:id/reactivate', protect, restrictTo('admin'), reactivateInstructor);

export default router;
