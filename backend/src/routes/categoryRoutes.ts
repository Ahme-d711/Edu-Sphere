import { Router } from 'express';
import {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from '../controllers/categoryController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';

const router = Router();

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/', getAllCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Get single category
 * @access  Public
 */
router.get('/:id', getCategory);

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private (admin or instructor)
 */
router.post('/', protect, restrictTo('admin', 'instructor'), createCategory);

/**
 * @route   PATCH /api/categories/:id
 * @desc    Update category
 * @access  Private (admin or instructor)
 */
router.patch('/:id', protect, restrictTo('admin', 'instructor'), updateCategory);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Soft delete category
 * @access  Private (admin only)
 */
router.delete('/:id', protect, restrictTo('admin'), deleteCategory);

/**
 * @route   PATCH /api/categories/:id/restore
 * @desc    Restore soft-deleted category
 * @access  Private (admin only)
 */
router.patch('/:id/restore', protect, restrictTo('admin'), restoreCategory);

export default router;
