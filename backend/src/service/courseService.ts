import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Course } from '../models/courseModel.js';

/**
 * Get course by ID — includes inactive courses (bypasses pre hook)
 */
export const findCourseIncludingInactive = async (id: string) => {
  const course = await Course.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });

  if (!course) throw AppError.notFound('Course not found');
  return course;
};

/**
 * Restore soft-deleted course
 */
export const restoreCourseService = async (id: string) => {
  const course = await findCourseIncludingInactive(id);

  if (course.isActive) throw AppError.badRequest('This Course is already active');

  await Course.updateOne({ _id: course._id }, { $set: { isActive: true } });

  const updatedCourse = await Course.findById(id).select(
    '-password -passwordResetToken -passwordResetExpires'
  );

  return updatedCourse;
};