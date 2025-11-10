import mongoose from 'mongoose';
import UserModel from '../models/userModel.js';
import { AppError } from '../utils/AppError.js';

/**
 * Get user by ID — includes inactive users (bypasses pre hook)
 */
export const findUserIncludingInactive = async (id: string) => {
  const user = await UserModel.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });

  if (!user) throw AppError.notFound('User not found');
  return user;
};

/**
 * Reactivate user account
 */
export const reactivateUserService = async (id: string) => {
  const user = await findUserIncludingInactive(id);

  if (user.isActive) throw AppError.badRequest('This user is already active');

  await UserModel.updateOne({ _id: user._id }, { $set: { isActive: true } });

  const updatedUser = await UserModel.findById(id).select(
    '-password -passwordResetToken -passwordResetExpires'
  );

  return updatedUser;
};
