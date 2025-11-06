import { Router } from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  logout,
  updatePassword,
} from '../controllers/authController.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import { protect } from '../middlewares/authMiddlewares.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT
 * @access  Public
 */
router.post('/login', loginLimiter, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and delete JWT
 * @access  Private
 */
router.post('/logout', protect, logout);


/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.patch('/forgot-password', loginLimiter, forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.patch('/reset-password/:token', resetPassword);

/**
 * @route   PATCH /api/auth/update-password
 * @desc    Update password with token
 * @access  Public
 */
router.patch('/update-password', protect, updatePassword);

export default router;