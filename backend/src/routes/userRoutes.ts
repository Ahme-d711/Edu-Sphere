import { Router } from 'express';
import {
  getMe, updateMe, updateProfilePic
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddlewares.js';
import { uploadSingle } from '../middlewares/uploadImage.js';
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

export default router;