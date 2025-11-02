import { asyncHandler } from "../utils/asyncHandler.js";
import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../types/userTypes.js";
import { AppError } from "../utils/AppError.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../service/imageService.js";
import { filterObj } from "../utils/FilterObj.js";
import UserModel from "../models/userModel.js";

/**
 * Get current logged-in user
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const userResponse = user.toJSON();

  res.status(200).json({
    status: 'success',
    data: {
      user: userResponse,
    },
  });
});

/**
 * Update current user profile (name, phone, gender only)
 */
export const updateMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. منع تحديث password
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      AppError.badRequest('This route is not for password updates. Use /update-password')
    );
  }

  // 2. منع تحديث email و role
  if (req.body.email) {
    return next(AppError.badRequest('Email cannot be updated. Contact support if needed.'));
  }
  if (req.body.role) {
    return next(AppError.badRequest('Role cannot be changed.'));
  }

  // 3. فلترة الحقول المسموحة (name, phoneNumber, gender)
  const filteredBody = filterObj(req.body, 'name', 'phoneNumber', 'gender');

  // 4. تحديث المستخدم (بطريقة آمنة)
  const updatedUser = await UserModel.findByIdAndUpdate(
    req.user._id, // req.user مضمون من protect
    filteredBody,
    {
      new: true,
      runValidators: true,
      select: 'name email phoneNumber gender profilePicture role', // فقط الحقول المرغوبة
    }
  );

  if (!updatedUser) {
    return next(AppError.notFound('User not found'));
  }

  // 5. الرد (يُطبّق transform من userModel)
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

/**
 * Update user profile picture
 */
export const updateProfilePic = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. تأكد من وجود الملف
    if (!req.file) {
      return next(AppError.badRequest('Please upload a profile picture'));
    }

    const user = req.user as IUser;

    // 2. حذف الصورة القديمة (إن وجدت)
    if (user.profilePic) {
      try {
        const publicId = user.profilePic
          .split('/')
          .slice(-2)
          .join('/')
          .split('.')[0];

        await deleteFromCloudinary(publicId as string);
      } catch (error) {
        console.warn('Failed to delete old profile picture:', error);
        // لا نُوقف العملية — الصورة القديمة تبقى (لكن نُسجّل)
      }
    }

    // 3. رفع الصورة الجديدة
    const result = await uploadToCloudinary(req.file, {
      folder: 'edu-sphere/profiles',
      publicId: `profile-${user._id}`,
      tags: ['profile', user._id.toString()],
      context: { userId: user._id.toString(), updatedAt: new Date().toISOString() },
    });

    // 4. تحديث المستخدم
    user.profilePic = result.secure_url;
    await user.save({ validateBeforeSave: false });

    // 5. الرد
    res.status(200).json({
      status: 'success',
      data: {
        profilePic: result.secure_url,
      },
    });
  }
);
