import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import InstructorModel from '../models/instructorModel.js';

/**
 * Get instructor by ID — includes inactive instructors (bypasses pre hook)
 */
export const findInstructorIncludingInactive = async (id: string) => {
  const instructor = await InstructorModel.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });

  if (!instructor) throw AppError.notFound('Instructor not found');
  return instructor;
};

/**
 * Restore soft-deleted instructor
 */
export const restoreInstructorService = async (id: string) => {
  const instructor = await findInstructorIncludingInactive(id);

  if (instructor.isActive)
    throw AppError.badRequest('This Instructor is already active');

  await InstructorModel.updateOne(
    { _id: instructor._id },
    { $set: { isActive: true } }
  );

  const updatedInstructor = await InstructorModel.findById(id).select(
    '-password -passwordResetToken -passwordResetExpires'
  );

  return updatedInstructor;
};

