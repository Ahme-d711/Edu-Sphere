import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { Course } from '../models/courseModel.js';
import type { ICourse } from '../types/courseTypes.js';
import InstructorModel from '../models/instructorModel.js';
import { courseQuerySchema, createCourseSchema, updateCourseSchema } from '../schemas/courseSchemas.js';
import { Category } from '../models/categoryModel.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import type { Query } from 'mongoose';
import { restoreCourseService } from '../service/courseService.js';

/**
 * @desc Create new course
 * @route POST /api/courses
 * @access Private (Instructor only)
 */
export const createCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validate input
    const result = createCourseSchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const {
      title,
      description,
      category: categoryId,
      price,
      discountPrice,
      level,
      thumbnail,
    } = result.data;

    // 2. Verify instructor has active profile
    const instructor = await InstructorModel.findOne({ user: req.user?._id });
    if (!instructor) {
      return next(AppError.forbidden('You must have an active instructor profile to create courses'));
    }
    
    // 3. Verify category exists and is active
    const category = await Category.findById(categoryId).select("_id");

    if (!category) {
      return next(AppError.badRequest('Invalid or inactive category ID'));
    }

    const checkCourse: ICourse | null = await Course.findOne({ title });
    if (checkCourse && checkCourse.instructor._id.toString() === instructor?._id?.toString()) {
      return next(AppError.badRequest('You already have a course with this title'));
    }

    // 4. Create course
    const course = await Course.create({
      title,
      description,
      category: category._id,
      price,
      discountPrice,
      level,
      thumbnail,
      instructor: instructor._id,
      status: 'draft', // always start as draft
    });

    // 5. Populate full response
    await course.populate([
      {
        path: 'instructor',
        select: 'title ratingAverage totalStudents ratingCount',
        populate: {
          path: 'user',
          select: 'name profilePicture',
        },
      },
      {
        path: 'category',
        select: 'name slug',
      },
    ]);

    res.status(201).json({
      status: 'success',
      data: { course },
    });
  }
);

/**
 * @desc Get all published courses with advanced filtering, search, pagination, sorting
 * @route GET /api/courses
 * @access Public
 */
export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate query parameters
  const queryParams = courseQuerySchema.parse(req.query);

  const baseQuery = Course.find({ status: 'published' }) as Query<ICourse[], ICourse>;

  // 2. Build query with ApiFeatures
  const features = new ApiFeatures(baseQuery, queryParams)
    .filter()
    .search(['title', 'description'])
    .sort()
    .select()
    .paginate();

  // 3. Execute query
  const { results: courses, pagination } = await features.execute();

  // 4. Response
  res.status(200).json({
    status: 'success',
    results: courses.length,
    pagination,
    data: { courses },
  });
});

/**
 * @desc Get course by ID
 * @route GET /api/courses/:id
 * @access Public
 */
export const getCourseById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Find course by ID
    const course = await Course.findById(req.params.id);
    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    if (course.status !== 'published') {
      return next(AppError.forbidden('This course is not available'));
    }

    res.status(200).json({
      status: 'success',
      data: { course },
    });
  }
);

/**
 * @desc Update course (Instructor owns it OR Admin)
 * @route PATCH /api/courses/:id
 * @access Private (Instructor/Admin)
 */
export const updateCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    // 1. Find course with instructor & category
    const course = await Course.findById(courseId)
    .populate('instructor', '_id')
    .populate('category', '_id isActive');

    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    // 2. Authorization: Admin OR Course Instructor
    const instructor = await InstructorModel.findOne({ user: req.user._id  });
    
    if (!instructor) {
      return next(AppError.notFound('Instructor not found'));
    }
    const isOwner = instructor?._id?.toString() === course.instructor._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return next(AppError.forbidden('You are not allowed to edit this course'));
    }

    // 3. Validate input
    const result = updateCourseSchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const updates = result.data;

    // 4. Validate category if updated
    if (updates.category) {
      const category = await Category.findOne({
        _id: updates.category,
        isActive: true,
      });
      if (!category) {
        return next(AppError.badRequest('Invalid or inactive category'));
      }
    }

    // 5. Apply updates
    Object.assign(course, updates);

    // 6. Save with validation
    await course.save();

    // 7. Populate full response
    await course.populate([
      {
        path: 'instructor',
        select: 'title ratingAverage totalStudents ratingCount',
        populate: { path: 'user', select: 'name profilePicture' },
      },
      { path: 'category', select: 'name slug' },
    ]);

    res.status(200).json({
      status: 'success',
      data: { course },
    });
  }
);

/**
 * @desc Publish, unpublish, or archive a course
 * @route PATCH /api/courses/:id/status
 * @access Private (Instructor/Admin)
 */
export const updateCourseStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;

    // 1. Validate status
    if (!['draft', 'published', 'archived'].includes(status)) {
      return next(AppError.badRequest('Status must be draft, published, or archived'));
    }

    const course = await Course.findById(req.params.id).populate('instructor', '_id');
    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    // 2. Authorization
    const instructor = await InstructorModel.findOne({ user: req.user._id  });
    
    if (!instructor) {
      return next(AppError.notFound('Instructor not found'));
    }
    const isOwner = instructor?._id?.toString() === course.instructor._id.toString();    
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return next(AppError.forbidden('You cannot change this course status'));
    }

    // 3. Additional rule: Cannot publish without lessons
    if (status === 'published' && course.lessonsCount === 0) {
      return next(
        AppError.badRequest('Cannot publish a course with no lessons. Add at least one lesson.')
      );
    }

    // 4. Update status
    course.status = status;
    await course.save({ validateBeforeSave: false });

    // 5. Populate response
    await course.populate([
      {
        path: 'instructor',
        select: 'title ratingAverage totalStudents',
        populate: { path: 'user', select: 'name profilePicture' },
      },
      { path: 'category', select: 'name slug' },
    ]);

    res.status(200).json({
      status: 'success',
      message: `Course is now ${status}`,
      data: { course },
    });
  }
);
/**
 * @desc Soft delete course (Instructor owns it OR Admin)
 * @route DELETE /api/courses/:id
 * @access Private (Instructor/Admin)
 */
export const deleteCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    // 1. Find course with instructor (to check ownership)
    const course = await Course.findById(courseId)
      .select('+isActive')

    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    // 2. Prevent deletion if already soft-deleted
    if (!course.isActive) {
      return next(AppError.badRequest('Course is already deleted'));
    }

    // 3. Authorization: Admin OR Course Instructor
    const instructor = await InstructorModel.findOne({ user: req.user._id  });
    
    if (!instructor) {
      return next(AppError.notFound('Instructor not found'));
    }
    const isOwner = instructor?._id?.toString() === course.instructor._id.toString();    
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return next(AppError.forbidden('You are not allowed to delete this course'));
    }

    // 4. Soft delete
    await course.softDelete();

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }
);

/**
 * @desc Restore a soft-deleted course
 * @route PATCH /api/courses/:id/restore
 * @access Private (Admin/Instructor)
 */
/**
 * Restore soft-deleted course (admin or course owner only)
 * @route   PATCH /api/courses/:id/restore
 * @access  Private (admin, instructor)
 */
export const restoreCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    
    const course = await restoreCourseService(req.params.id as string);

    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    if (course.isActive) {
      return next(AppError.badRequest('Course is already active'));
    }

    // 2. Restore
    await course.restore();

    res.status(200).json({
      status: 'success',
      message: 'Course restored successfully',
      data: { course },
    });
  }
);

