import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Category } from '../models/categoryModel.js';

/**
 * Get category by ID — includes inactive categories (bypasses pre hook)
 */
export const findCategoryIncludingInactive = async (id: string) => {
  const category = await Category.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });

  if (!category) throw AppError.notFound('Category not found');
  return category;
};

/**
 * Reactivate user account
 */
export const restoreCategoryService = async (id: string) => {
  const category = await findCategoryIncludingInactive(id);

  if (category.isActive) throw AppError.badRequest('This Category is already active');

  await Category.updateOne({ _id: category._id }, { $set: { isActive: true } });

  const updatedCategory = await Category.findById(id).select(
    '-password -passwordResetToken -passwordResetExpires'
  );

  return updatedCategory;
};
