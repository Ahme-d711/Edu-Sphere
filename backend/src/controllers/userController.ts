import { asyncHandler } from "../utils/asyncHandler.js";
import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../types/userTypes.js";
import { AppError } from "../utils/AppError.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../service/imageService.js";
import { filterObj } from "../utils/FilterObj.js";
import UserModel from "../models/userModel.js";
import { userQuerySchema } from "../schemas/userSchemas.js";
import ApiFeatures from "../utils/ApiFeatures.js";
import { reactivateUserService } from "../service/userService.js";

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
      select: 'name email phoneNumber gender profilePic role', // فقط الحقول المرغوبة
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


/**
 * Soft delete current user account
 */
export const deleteMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await UserModel.findById(req.user._id).select('+active +profilePic');

  if (!user) {
    return next(AppError.notFound('User not found'));
  }

  // 1. حذف الصورة من Cloudinary (إن وجدت)
  if (user.profilePic) {
    try {
      const publicId = user.profilePic
        .split('/')
        .slice(-2)
        .join('/')
        .split('.')[0];
      await deleteFromCloudinary(publicId as string);
    } catch (error) {
      console.warn('Failed to delete profile picture from Cloudinary:', error);
      // لا نُوقف العملية
    }
  }

  // 2. Soft delete
  user.active = false;
  user.profilePic = "";
  await user.save({ validateBeforeSave: false });

  // 3. إبطال الجلسة: حذف الكوكي
  res.clearCookie('edu_token', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
  });

  // 4. الرد
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * Get all users (admin only)
 * @access  Private (admin)
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validate & parse query
    const queryParams = userQuerySchema.parse(req.query);

    // 2. Build query with ApiFeatures
    const features = new ApiFeatures<IUser>(UserModel.find({ active: true }), queryParams)
      .filter()
      .search(['userName'])
      .sort()
      .select()
      .paginate();

    // 3. Execute
    const { results: users, pagination } = await features.execute();

    // 4. Empty result
    if (users.length === 0) {
      return next(AppError.notFound('No users found'));
    }

    // 5. Response
    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination,
      data: { users },
    });
  }
);

/**
 * Get a specific user by ID
 */
export const getUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await UserModel.findById(req.params['id'])
  .select('-password -passwordResetToken -passwordResetExpires');

  if (!user || !user.active) {
    return next(AppError.notFound('No user found with that ID'));
  }

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

/**
 * Update user by ID (admin only)
 * @access  Private (admin)
 */
export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. منع تحديث email و password
  if (req.body.email) {
    return next(AppError.badRequest('Email cannot be updated via this route'));
  }
  if (req.body.password || req.body.passwordConfirm) {
    return next(AppError.badRequest('Use /update-password to change password'));
  }

  // 2. فلترة الحقول المسموحة (بدون email)
  const filteredBody = filterObj(req.body, 'name', 'role', 'phoneNumber', 'gender', 'active');

  // 3. تحديث المستخدم
    const user = await UserModel.findByIdAndUpdate(req.params['id'], filteredBody, {
      new: true,
      runValidators: true,
    }).select('-password -passwordResetToken -passwordResetExpires');


  if (!user) {
    return next(AppError.notFound('No user found with that ID'));
  }

  // 4. تحقق من الحالة (soft delete)
  if (!user.active) {
    return next(AppError.badRequest('This user account is deactivated'));
  }

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

/**
 * Soft delete user by ID (admin only)
 * @access  Private (admin)
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // 1. جلب المستخدم مع الصورة
  const user = await  UserModel.findById(req.params['id']).select('+profilePic +active')

  if (!user) {
    return next(AppError.notFound('No user found with that ID'));
  }

  if (!user.active) {
    return next(AppError.badRequest('This user is already deactivated'));
  }

  // 2. حذف الصورة من Cloudinary
  if (user.profilePic) {
    try {
      const publicId = user.profilePic
        .split('/')
        .slice(-2)
        .join('/')
        .split('.')[0]; // gym-app/profiles/profile-xxx
      await deleteFromCloudinary(publicId as string);
    } catch (error) {
      console.warn('Failed to delete profile picture:', error);
      // لا نُوقف العملية
    }
  }

  // 3. Soft delete
  await UserModel.findByIdAndUpdate(
    req.params['id'],
    { 
      active: false,
      profilePic: undefined 
    },
    { runValidators: true }
  );

  res.status(204).json({
    status: 'success',
    data: null,
  });
});


/**
 * Reactivate a deactivated user (admin only)
 * @access  Private (admin)
 */
export const reactivateUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;


    if (!userId) {
      return next(AppError.badRequest('User ID is required'));
    }
    

    // 1. Reactivate via service
    const user = await reactivateUserService(userId);

    // 2. Handle not found
    if (!user) {
      return next(AppError.notFound('User not found or already active'));
    }

    // 3. Populate user data (optional, for consistency)
    await user.populate({
      path: 'profilePicture',
      select: 'secure_url',
    });

    res.status(200).json({
      status: 'success',
      message: 'User reactivated successfully',
      data: { user },
    });
  }
);