import { asyncHandler } from '../utils/asyncHandler.js';
import type { NextFunction, Request, Response } from 'express';
import InstructorModel from '../models/instructorModel.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { instructorQuerySchema, instructorValidationSchema, updateInstructorSchema } from '../schemas/instructorSchemas.js';
import type { IInstructor } from '../types/instructorTypes.js';
import type { Query } from 'mongoose';
import { filterObj } from '../utils/FilterObj.js';
import { AppError } from '../utils/AppError.js';
import UserModel from '../models/userModel.js';

/**
 * @desc Get all instructors
 * @route GET /api/v1/instructors
 * @access Public
 */
export const getAllInstructors = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate query params
  const queryParams = instructorQuerySchema.parse(req.query);

  const baseQuery = InstructorModel.find() satisfies Query<IInstructor[], IInstructor>;


  // 2. Build query with ApiFeatures
  const features = new ApiFeatures(baseQuery, queryParams)
  .filter()
    .search(['title', 'bio', 'expertise'])
    .sort()
    .select()
    .paginate();

  // 3. Execute
  const { results: instructors, pagination } = await features.execute();

  // 4. Response
  res.status(200).json({
    status: 'success',
    results: instructors.length,
    pagination,
    data: { instructors },
  });
});


/**
 * @desc Get instructor by ID
 * @route GET /api/instructors/:id
 * @access Public
 */
export const getInstructor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const instructor = await InstructorModel.findById(req.params['id']);

  if (!instructor) return next(AppError.notFound('Instructor not found'));

  res.status(200).json({
    status: 'success',
    data: { instructor },
  });
});

/**
 * @desc Create new instructor (admin only)
 * @route POST /api/v1/instructors
 * @access Private (admin)
 */
export const createInstructor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validate input
    const result = instructorValidationSchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const { user: userId, title, bio, expertise, socialLinks } = result.data;

    // 2. Check if user exists and is active
    const user = await UserModel.findById(userId);
    if (!user) {
      return next(AppError.badRequest('User not found'));
    }
    if (!user.active) {
      return next(AppError.badRequest('Cannot assign deactivated user as instructor'));
    }

    // 3. Check if instructor already exists for this user
    const existing = await InstructorModel.findOne({ user: userId });
    if (existing) {
      return next(AppError.badRequest('This user is already an instructor'));
    }

    // 4. Create instructor
    const instructor = await InstructorModel.create({
      user: userId,
      title,
      bio,
      expertise,
      socialLinks,
    });

    await UserModel.findByIdAndUpdate(userId, { role: 'instructor' });
    
    // 5. Populate user data
    await instructor.populate({
      path: 'user',
      select: 'name email profilePicture role gender',
    });

    res.status(201).json({
      status: 'success',
      data: { instructor },
    });
  }
);

/**
 * @desc Update instructor by ID
 * @route PATCH /api/v1/instructors/:id
 * @access Private (admin or self)
 */
export const updateInstructor = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const instructorId = req.params.id;

    // 1. Get instructor with user reference
    const instructor = await InstructorModel.findById(instructorId).populate({
      path: 'user',
      select: '_id',
    });

    if (!instructor) {
      return next(AppError.notFound('Instructor not found'));
    }

    // 2. Authorization: admin or self
    const isAdmin = req.user.role === 'admin';
    const isSelf = instructor.user._id.toString() === req.user._id.toString();

    if (!isAdmin && !isSelf) {
      return next(AppError.forbidden('You can only update your own instructor profile'));
    }

    // 3. Validate & filter input
    const result = updateInstructorSchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const filteredBody = filterObj(
      result.data,
      'title',
      'bio',
      'expertise',
      'socialLinks'
    );

    // 4. Update with populate
    const updatedInstructor = await  InstructorModel.findByIdAndUpdate(instructorId, filteredBody, {
        new: true,
        runValidators: true,
      });

    res.status(200).json({
      status: 'success',
      data: { instructor: updatedInstructor },
    });
  }
);

/**
 * @desc Soft delete instructor by ID (admin only)
 * @route DELETE /api/v1/instructors/:id
 * @access Private (admin)
 */
// export const deleteInstructor = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const instructorId = req.params.id;

//     // 1. Find instructor with user reference
//     const instructor = await InstructorModel.findById(instructorId).populate({
//       path: 'user',
//       select: '_id',
//     });

//     if (!instructor) {
//       return next(AppError.notFound('Instructor not found'));
//     }

//     // 2. Prevent self-deletion if admin is the instructor
//     const isSelf = req.user._id.toString() === instructor.user._id.toString();
//     if (isSelf) {
//       return next(AppError.forbidden('You cannot delete your own instructor profile'));
//     }

//     // 3. Soft delete
//     await InstructorModel.findByIdAndUpdate(
//       instructorId,
//       { isActive: false },
//       { runValidators: true }
//     );

//     res.status(204).json({
//       status: 'success',
//       data: null,
//     });
//   }
// );

/**
 * @desc Reactivate instructor (admin only)
 * @route PATCH /api/v1/instructors/:id/reactivate
 * @access Private (admin)
 */
// export const reactivateInstructor = asyncHandler(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const instructorId = req.params.id;

//     // 1. Find instructor with necessary fields
//     const instructor = await InstructorModel.findById(instructorId)
//       .select('+isActive')
//       .populate({
//         path: 'user',
//         select: '_id',
//       });

//     if (!instructor) {
//       return next(AppError.notFound('Instructor not found'));
//     }

//     // 2. Check current status
//     if (instructor.isActive) {
//       return next(AppError.badRequest('Instructor is already active'));
//     }

//     // 3. Reactivate
//     const updatedInstructor = await InstructorModel.findByIdAndUpdate(
//       instructorId,
//       { isActive: true },
//       {
//         new: true,
//         runValidators: true,
//         select: '-password -__v',
//       }
//     ).populate({
//       path: 'user',
//       select: 'name email profilePicture role gender',
//     });

//     res.status(200).json({
//       status: 'success',
//       message: 'Instructor reactivated successfully',
//       data: { instructor: updatedInstructor },
//     });
//   }
// );