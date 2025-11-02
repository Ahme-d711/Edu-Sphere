import UserModel from '../models/userModel.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupValidationSchema } from '../schemas/userSchemas.js';
import type { ZodIssue } from 'zod';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { Request, Response, NextFunction } from 'express';
import { createSendToken } from '../utils/sendToken.js';
import type { IUser, IUserMethods } from '../types/userTypes.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import crypto from 'crypto';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. Validate input
  const result = signupValidationSchema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues.map((i: ZodIssue) => i.message).join(', ');
    return next(AppError.badRequest(message));
  }

  // 2. Create user (Mongoose يُطبّق pre-save hash + transform)
  let newUser;
  try {
    newUser = await UserModel.create({
      ...result.data,
    });
  } catch (error: unknown) {
    // 3. Handle duplicate email (E11000)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'keyValue' in error &&
      error.code === 11000 &&
      typeof error.keyValue === 'object' &&
      error.keyValue !== null
    ) {
      const field = Object.keys(error.keyValue)[0];
      return next(AppError.badRequest(`This ${field} is already taken`));
    }
    return next(error); // أخطاء أخرى تُمرر لـ globalError
  }

  // 4. Send token + user (بدون password)
  createSendToken(newUser, 201, res);
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. Validate input
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues.map(i => i.message).join(', ');
    return next(AppError.badRequest(message));
  }

  const { email, password } = result.data;

  // 2. Find user with password
  const user = await UserModel.findOne({ email }).select('+password');
  if (!user || !(await (user as IUser & IUserMethods).comparePassword(password))) {
    return next(AppError.unauthorized('Incorrect email or password'));
  }

  if (!user.active) {
    return next(AppError.unauthorized('Account is not active'));
  }

  // 3. Send token + user
  createSendToken(user, 200, res);
});

/**
 * Logout user by clearing JWT cookie
 */
    // @ts-expect-error Too complex union
export const logout = asyncHandler(( req: Request, res: Response) => {
  // 1. مسح الكوكي بأعلى أمان
  res.cookie('edu_token', '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(0), // فوري
  });

  // 2. رد واضح
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

/**
 * Forgot Password - Send reset token
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. Validate email
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Invalid email address provided for password reset';
    return next(AppError.badRequest(message));
  }
  const { email } = result.data;

  // 2. Find user
  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(AppError.notFound('No user found with that email'));
  }

  // 3. Generate token
  const resetToken = await (user as IUser & IUserMethods).generateResetToken();
  await user.save({ validateBeforeSave: false });  

  // 4. Send email
  const resetUrl = `${process.env['CLIENT_URL']}/auth/reset-password/${resetToken}`;

  try {
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl);
    if (!emailSent) {
      throw new Error('Email failed');
    }

    res.status(200).json({
      status: 'success',
      message: 'Reset token sent to email',
    });
  } catch{    
    // 5. Clean up on failure
    // @ts-expect-error Too complex union
    user.passwordResetToken = undefined;
    // @ts-expect-error Too complex union
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(AppError.badRequest('Failed to send reset email. Try again later.'));
  }
});

/**
 * Reset Password - Update password
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. Validate password
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues.map(i => i.message).join(', ');
    return next(AppError.badRequest(message));
  }
  
  const { password } = result.data;
  const { token } = req.params as { token: string };

  if (!token) {
    return next(AppError.badRequest('Reset token is missing'));
  }

  // 2. Hash token and find user
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex') as string;

  const user = await UserModel.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(AppError.badRequest('Token is invalid or has expired'));
  }

  // 3. Update password + cleanup
  user.password = password;
  // @ts-expect-error Too complex union
  user.passwordResetToken = undefined;
  // @ts-expect-error Too complex union
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date(); // مهم لـ protect middleware
  await user.save();

  // 4. Login user
  createSendToken(user, 200, res);
});

