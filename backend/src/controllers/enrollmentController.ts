import { asyncHandler } from '../utils/asyncHandler.js';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { Enrollment } from '../models/enrollmentModel.js';
import { Course } from '../models/courseModel.js';
import type { IUser } from '../types/userTypes.js';
import { createEnrollmentSchema, enrollmentQuerySchema, updateProgressSchema } from '../schemas/enrollmentValidator.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { LessonModel } from '../models/lessonModel.js';
import type { IEnrollment } from '../types/enrollmentTypes.js';
import type { Query } from 'mongoose';

/**
 * @desc Enroll user in a course
 * @route POST /api/v1/enrollments/:courseId
 * @access Private (student)
 */
export const enrollInCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const user = req.user as IUser;

    // 1. Validate input
    createEnrollmentSchema.parseAsync({ course: courseId });

    // 2. Check course exists & published
    const course = await Course.findById(courseId)
      .select('status instructor lessonsCount')
      .populate('instructor', '_id');

    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    if (course.status !== 'published') {
      return next(AppError.badRequest('This course is not available for enrollment'));
    }

    // 3. Prevent instructor self-enrollment
    if (course.instructor._id.toString() === user._id.toString()) {
      return next(AppError.badRequest('Instructors cannot enroll in their own courses'));
    }

    // 4. Check for existing active enrollment
    console.log(user, courseId);
    
    const existing = await Enrollment.findByUserAndCourse(user._id, courseId);
    if (existing) {
      return next(AppError.conflict('You are already enrolled in this course'));
    }

    // 5. Create enrollment
    const enrollment = await Enrollment.create({
      user: user._id,
      course: courseId,
    });

    // 6. Update stats
    await course.updateStats();

    res.status(201).json({
      status: 'success',
      data: { enrollment },
    });
  }
);

/**
 * @desc Get all enrollments for current user
 * @route GET /api/v1/enrollments/my
 * @access Private (student)
 */
export const getMyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;

  const queryParams = enrollmentQuerySchema.parse(req.query);
  const baseQuery = Enrollment.find({ user: user._id }) as Query<IEnrollment[], IEnrollment>

  const features = new ApiFeatures(
    baseQuery,
    queryParams
  )
    .filter()
    .sort()
    .select()
    .paginate();

  const { results: enrollments, pagination } = await features.execute();

  res.status(200).json({
    status: 'success',
    results: enrollments.length,
    pagination,
    data: { enrollments },
  });
});

/**
 * @desc Get all enrollments (admin only)
 * @route GET /api/v1/enrollments
 * @access Private (admin)
 */
export const getAllEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const queryParams = enrollmentQuerySchema.parse(req.query);
  const features = new ApiFeatures(Enrollment.find(), queryParams)
    .filter()
    .sort()
    .select()
    .paginate();

  const { results: enrollments, pagination } = await features.execute();

  res.status(200).json({
    status: 'success',
    results: enrollments.length,
    pagination,
    data: { enrollments },
  });
});

/**
 * @desc Cancel enrollment (soft delete)
 * @route DELETE /api/v1/enrollments/:id
 * @access Private (student/admin)
 */
export const cancelEnrollment = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser;
    const enrollmentId = req.params.id;

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('course', 'instructor');

    if (!enrollment) {
      return next(AppError.notFound('Enrollment not found'));
    }

    // Authorization
    const isAdmin = user.role === 'admin';
    const isOwner = enrollment.user.toString() === user._id.toString();

    if (!isAdmin && !isOwner) {
      return next(AppError.forbidden('You cannot cancel this enrollment'));
    }

    if (enrollment.status === 'cancelled') {
      return next(AppError.badRequest('Enrollment is already cancelled'));
    }

    await enrollment.softDelete();

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }
);

/**
 * @desc Mark lesson as completed & update progress
 * @route PATCH /api/v1/enrollments/:id/progress
 * @access Private (student)
 */
export const updateProgress = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser;
    const enrollmentId = req.params.id;

    // 1. Validate input
    const { lessonId } = updateProgressSchema.parse(req.body);

    // 2. Find enrollment
    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment) {
      return next(AppError.notFound('Enrollment not found'));
    }

    if (enrollment.user.toString() !== user._id.toString()) {
      return next(AppError.forbidden('You can only update your own progress'));
    }

    if (enrollment.status === 'cancelled') {
      return next(AppError.badRequest('Cannot update progress for cancelled enrollment'));
    }

    // 3. Validate lesson belongs to course
    const lesson = await LessonModel.findById(lessonId).select('course isActive');
    if (!lesson || !lesson.isActive) {
      return next(AppError.notFound('Lesson not found'));
    }

    if (lesson.course.toString() !== enrollment.course.toString()) {
      return next(AppError.badRequest('This lesson does not belong to the enrolled course'));
    }

    // 4. Mark lesson completed
    await enrollment.markLessonCompleted(lessonId);

    res.status(200).json({
      status: 'success',
      data: { enrollment },
    });
  }
);