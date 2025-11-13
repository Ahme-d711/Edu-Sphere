import { Router } from 'express';
import {
  deleteMe,
  deleteUser,
  getAllUsers,
  getMe, getUser, reactivateUser, updateMe, updateProfilePic, updateUser
} from '../controllers/userController.js';
import { protect, restrictTo } from '../middlewares/authMiddlewares.js';
import { uploadSingle } from '../middlewares/uploadImage&Video.js';
const router = Router();

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route PATCH /api/user/update
 * @desc Update User
 * @access Private
 */
router.patch('/update-me', protect, updateMe)

/**
 * @route   PATCH /api/user/update-profile-pic
 * @desc    Update user profile picture
 * @access  Private
 */
router.patch('/update-profile-pic', protect, uploadSingle('profilePic'), updateProfilePic);

/**
 * @route   DELETE /api/user/update-profile-pic
 * @desc    Delete user 
 * @access  Private
 */
router.delete('/me', protect, deleteMe)

/**
 * @route   GET /api/user/
 * @desc    Get all user 
 * @access  Private (admin only)
 */
router
  .route('/')
  .get(protect, restrictTo('admin'), getAllUsers);

  /**
 * @route   GET /api/user/:id
 * @desc    Get user 
 * @access  Private (admin only)
 */
router
  .route('/:id')
  .get(protect, getUser);

  /**
 * @route   PATCH /api/user/:id
 * @desc    Update user 
 * @access  Private (admin only)
 */
router
  .route('/:id')
  .patch(protect, restrictTo('admin'), updateUser);

/**
 * @route   DELETE /api/user/:id
 * @desc    Delete user 
 * @access  Private (admin only)
 */
router
  .route('/:id')
  .delete(protect, restrictTo('admin'), deleteUser);

/**
 * Reactivate a deactivated user (admin only)
 * @route   PATCH /api/users/:id/reactivate
 * @access  Private (admin)
 */
router
  .patch('/:id/reactivate', protect, restrictTo('admin'), reactivateUser);

export default router;