import { asyncHandler } from '../utils/asyncHandler.js';
import type { Request, Response, NextFunction } from 'express';
import { LessonModel } from '../models/lessonModel.js';
import { AppError } from '../utils/AppError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../service/cloudinaryService.js';
import type { MulterFile } from '../types/express-multer.js';
import ffmpeg, { type FfprobeData } from 'fluent-ffmpeg';

import streamifier from 'streamifier';
import { PassThrough } from 'stream';
import { Course } from '../models/courseModel.js';
import InstructorModel from '../models/instructorModel.js';
import ApiFeatures from '../utils/ApiFeatures.js';
import { lessonQuerySchema } from '../schemas/lessonSchemas.js';
import type { ILesson } from '../types/lessonTypes.js';
import type { Query } from 'mongoose';

// === Helper: Get video duration (fixed) ===
const getVideoDuration = (buffer: Buffer): Promise<number> => {
  return new Promise((resolve, reject) => {
    const input = streamifier.createReadStream(buffer);

    ffmpeg(input)
      .ffprobe((err: Error | null, metadata: FfprobeData) => {
        if (err) return reject(err);

        const duration = metadata.format?.duration;
        if (!duration) return reject(new Error('Duration not found in metadata'));
        resolve(duration);
      });
  });
};

/**
 * Create a new lesson with video + auto thumbnail + duration
 * @route POST /api/v1/lessons
 * @access Private (Instructor/Admin)
 */
export const createLesson = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, content, course, order, isFreePreview } = req.body;

    // 1. Validate required fields
    if (!req.file) {
      return next(AppError.badRequest('Video file is required'));
    }
    if (!title || !course) {
      return next(AppError.badRequest('Title and course ID are required'));
    }

    const videoFile: MulterFile = req.file;

    // 2. Validate course exists & belongs to instructor
    const courseDoc = await Course.findById(course)
      .populate('instructor', '_id')
      .select('instructor status');

    if (!courseDoc) {
      return next(AppError.notFound('Course not found'));
    }

    const instructor = await InstructorModel.findOne({ user: req.user._id  });

    if (!instructor) {
      return next(AppError.notFound('Instructor not found'));
    }
    const isOwner = instructor?._id?.toString() === courseDoc.instructor._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return next(AppError.forbidden('You can only add lessons to your own courses'));
    }

    if (courseDoc.status !== 'published' && courseDoc.status !== 'draft') {
      return next(AppError.badRequest('Cannot add lessons to archived courses'));
    }

    console.log("preeee");
    
    // 3. Upload video
    const videoResult = await uploadToCloudinary(videoFile, {
      folder: `edu-sphere/courses/${course}/lessons`,
      resourceType: 'video',
      allowedFormats: ['mp4', 'webm', 'ogg', 'mov'],
      tags: ['lesson', 'video'],
      context: { course_id: course },
    });

    console.log("neeee");
    

    // 4. Generate thumbnail from first frame
    let thumbnailUrl = '';
    let thumbnailPublicId = '';

    try {
      const thumbnailBuffer = await generateVideoThumbnail(videoFile.buffer);
      const thumbResult = await uploadToCloudinary(
        { ...videoFile, buffer: thumbnailBuffer, originalname: 'thumb.jpg' },
        {
          folder: `edu-sphere/courses/${course}/thumbnails`,
          resourceType: 'image',
          publicId: `${videoResult.public_id}_thumb`,
        }
      );
      thumbnailUrl = thumbResult.secure_url;
      thumbnailPublicId = thumbResult.public_id;
    } catch (err) {
      console.warn('Thumbnail generation failed:', err);
      // Continue without thumbnail
    }

    // 5. Get video duration
    let duration = 0;
    try {
      duration = Math.round(await getVideoDuration(videoFile.buffer));
    } catch (err) {
      console.warn('Duration detection failed:', err);
    }

    // 6. Create lesson
    const lesson = await LessonModel.create({
      title,
      content: content || '',
      course,
      videoUrl: videoResult.secure_url,
      videoPublicId: videoResult.public_id,
      thumbnailUrl,
      thumbnailPublicId,
      duration,
      order: order ? parseInt(order) : undefined,
      isFreePreview: isFreePreview === 'true',
    });

    // 7. Update course stats
    await courseDoc.updateStats();

    // 8. Populate response
    await lesson.populate([
      { path: 'course', select: 'title slug' },
    ]);

    res.status(201).json({
      status: 'success',
      data: { lesson },
    });
  }
);

// === Helper: Generate thumbnail from video buffer ===
const generateVideoThumbnail = (buffer: Buffer): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const input = streamifier.createReadStream(buffer);
    const output = new PassThrough();

    const chunks: Buffer[] = [];
    output.on('data', (chunk) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);

    ffmpeg(input)
      .screenshots({
        count: 1,
        timestamps: ['10%'],
        size: '640x360',
        folder: '/tmp',
        filename: 'thumb.jpg',
      })
      .on('end', () => {
        // Read from /tmp or use pipe
        // For simplicity, we use pipe to memory
        input.pipe(
          ffmpeg()
            .seekInput('00:00:03')
            .frames(1)
            .size('640x360')
            .outputOptions('-q:v 2')
            .pipe(output, { end: true })
        );
      })
      .on('error', reject);
  });
};

/**
 * Soft delete lesson + remove video & thumbnail from Cloudinary
 * @route   DELETE /api/v1/lessons/:id
 * @access  Private (Instructor/Admin)
 */
export const deleteLesson = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const lessonId = req.params.id;

    // 1. Find lesson with course & instructor
    const lesson = await LessonModel.findById(lessonId)
      .select('+isActive videoPublicId thumbnailPublicId')
      .populate({
        path: 'course',
        select: 'instructor status',
        populate: { path: 'instructor', select: '_id' },
      });

    if (!lesson) {
      return next(AppError.notFound('Lesson not found'));
    }

    // 2. Prevent deletion if already soft-deleted
    if (!lesson.isActive) {
      return next(AppError.badRequest('Lesson is already deleted'));
    }

    // 3. Authorization: Admin OR Course Instructor
    // const instructor = await InstructorModel.findOne({ user: req.user._id  });

    // if (!instructor) {
    //   return next(AppError.notFound('Instructor not found'));
    // }
    // const isAdmin = req.user.role === 'admin';
    // const isOwner = lesson.course.instructor._id.toString() === instructor.id.toString();

    // if (!isAdmin && !isOwner) {
    //   return next(AppError.forbidden('You can only delete lessons from your own courses'));
    // }

    // 4. Delete assets from Cloudinary (in parallel)
    const deletePromises = [];

    if (lesson.videoPublicId) {
      deletePromises.push(
        deleteFromCloudinary(lesson.videoPublicId, 'video').catch((err) => {
          console.warn(`Failed to delete video ${lesson.videoPublicId}:`, err);
        })
      );
    }

    if (lesson.thumbnailPublicId) {
      deletePromises.push(
        deleteFromCloudinary(lesson.thumbnailPublicId, 'image').catch((err) => {
          console.warn(`Failed to delete thumbnail ${lesson.thumbnailPublicId}:`, err);
        })
      );
    }

    await Promise.allSettled(deletePromises);

    // 5. Soft delete
    await lesson.softDelete();

    // 6. Update course stats

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }
);

/**
 * Get all active lessons for a course (with sorting, pagination, filtering)
 * @route   GET /api/v1/courses/:courseId/lessons
 * @access  Public (or Private for draft courses)
 */
export const getLessonsByCourse = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;

    // 1. Validate course exists
    const course = await Course.findById(courseId).select('status instructor');
    if (!course) {
      return next(AppError.notFound('Course not found'));
    }

    // 2. Authorization: Public for published, Private for draft/archived
    const isAdmin = req.user?.role === 'admin';
    const isInstructor = req.user?._id.toString() === course.instructor.toString();

    if (course.status !== 'published' && !isAdmin && !isInstructor) {
      return next(AppError.forbidden('You do not have access to view lessons for this course'));
    }

    // 3. Validate query params
    const queryParams = lessonQuerySchema.parse(req.query);

    const baseQuery = LessonModel.find({ course: courseId }) as Query<ILesson[], ILesson>;

    // 4. Build query with ApiFeatures
    const features = new ApiFeatures(
      baseQuery,
      queryParams
    )
      .filter()
      .search(['title', 'content'])
      .sort()
      .select()
      .paginate();

    // 5. Execute
    const { results: lessons, pagination } = await features.execute();

    res.status(200).json({
      status: 'success',
      results: lessons.length,
      pagination,
      data: { lessons },
    });
  }
);