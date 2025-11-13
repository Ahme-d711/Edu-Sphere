import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';
import { getDashboardStats } from '../controllers/adminController.js';

const router = express.Router();

// Protect all routes & restrict to admins only
router.use(protect);
router.use(restrictTo('admin'));

// GET /api/v1/admin/stats
router.get('/stats', getDashboardStats);

// GET /api/v1/admin/latest-users
// router.get('/latest-users', getLatestUsers);

// GET /api/v1/admin/latest-courses
// router.get('/latest-courses', getLatestCourses);

export default router;
