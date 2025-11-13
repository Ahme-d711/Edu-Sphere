import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { dashboardQuerySchema } from '../schemas/dashboardSchemas.js';
import UserModel from '../models/userModel.js';
import { Course } from '../models/courseModel.js';
import { Enrollment } from '../models/enrollmentModel.js';

/**
 * @desc Get platform dashboard statistics
 * @route GET /api/v1/admin/dashboard/stats
 * @access Private (admin)
 */
export const getDashboardStats = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = dashboardQuerySchema.parse(req.query);
    const { period = 'all' } = query;

    // 1. Define time range
    const now = new Date();
    let startDate: Date | null = null;

    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // 2. Build match filter
    const matchFilter = startDate ? { createdAt: { $gte: startDate } } : {};

    // 3. Aggregate stats in parallel
    const [
      usersCount,
      coursesCount,
      activeEnrollments,
      revenueResult,
      topCourses,
      userGrowth,
      enrollmentGrowth,
    ] = await Promise.all([
      // Total users
      UserModel.countDocuments(),

      // Total courses
      Course.countDocuments({ status: 'published' }),

      // Active enrollments
      Enrollment.countDocuments({ status: 'active', isActive: true }),

      // Revenue from published courses
      Enrollment.aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'courseData',
          },
        },
        { $unwind: '$courseData' },
        {
          $match: {
            ...matchFilter,
            status: 'active',
            isActive: true,
            'courseData.status': 'published',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$courseData.finalPrice' },
          },
        },
      ]),

      // Top 5 courses by enrollments
      Enrollment.aggregate([
        {
          $group: {
            _id: '$course',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
        {
          $project: {
            title: '$course.title',
            slug: '$course.slug',
            thumbnail: '$course.thumbnail',
            enrollments: '$count',
          },
        },
      ]),

      // User growth
      UserModel.aggregate([
        {
          $match: startDate ? { createdAt: { $gte: startDate } } : {},
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Enrollment growth
      Enrollment.aggregate([
        {
          $match: {
            ...matchFilter,
            status: 'active',
            isActive: true,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // 4. Calculate previous period for growth
    let prevRevenue = 0;
    let prevEnrollments = 0;

    if (startDate) {
      const prevStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
      const prevEnd = startDate;

      const [prevRev, prevEnr] = await Promise.all([
        Enrollment.aggregate([
          {
            $lookup: {
              from: 'courses',
              localField: 'course',
              foreignField: '_id',
              as: 'courseData',
            },
          },
          { $unwind: '$courseData' },
          {
            $match: {
              createdAt: { $gte: prevStart, $lt: prevEnd },
              status: 'active',
              isActive: true,
              'courseData.status': 'published',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$courseData.finalPrice' },
            },
          },
        ]),
        Enrollment.countDocuments({
          createdAt: { $gte: prevStart, $lt: prevEnd },
          status: 'active',
          isActive: true,
        }),
      ]);

      prevRevenue = prevRev[0]?.total || 0;
      prevEnrollments = prevEnr;
    }

    const currentRevenue = revenueResult[0]?.total || 0;
    const currentEnrollments = activeEnrollments;

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          totalUsers: usersCount,
          totalCourses: coursesCount,
          activeEnrollments,
          totalRevenue: currentRevenue,
        },
        growth: {
          revenueGrowth:
            prevRevenue > 0
              ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
              : currentRevenue > 0
              ? 100
              : 0,
          enrollmentGrowth:
            prevEnrollments > 0
              ? ((currentEnrollments - prevEnrollments) / prevEnrollments) * 100
              : currentEnrollments > 0
              ? 100
              : 0,
        },
        topCourses: topCourses.slice(0, 5),
        trends: {
          users: userGrowth.map((d) => ({ date: d._id, count: d.count })),
          enrollments: enrollmentGrowth.map((d) => ({ date: d._id, count: d.count })),
        },
        period,
      },
    });
  }
);

/**
 * @desc Get latest registered users
 * @route GET /api/v1/admin/dashboard/users
 * @access Private (admin)
 */
// export const getLatestUsers = asyncHandler(async (req: Request, res: Response) => {
//   const features = new ApiFeatures(
//     UserModel.find().select('name email role profilePicture createdAt'),
//     req.query
//   )
//     .sort()
//     .paginate();

//   const { results: users, pagination } = await features.execute();

//   res.status(200).json({
//     status: 'success',
//     results: users.length,
//     pagination,
//     data: { users },
//   });
// });

// /**
//  * @desc Get latest courses
//  * @route GET /api/v1/admin/dashboard/courses
//  * @access Private (admin)
//  */
// export const getLatestCourses = asyncHandler(async (req: Request, res: Response) => {
//   const features = new ApiFeatures(
//     Course.find()
//       .select('title slug thumbnail price finalPrice level status createdAt')
//       .populate({
//         path: 'instructor',
//         select: 'title',
//         populate: { path: 'user', select: 'name profilePicture' },
//       }),
//     req.query
//   )
//     .sort()
//     .select()
//     .paginate();

//   const { results: courses, pagination } = await features.execute();

//   res.status(200).json({
//     status: 'success',
//     results: courses.length,
//     pagination,
//     data: { courses },
//   });
// });