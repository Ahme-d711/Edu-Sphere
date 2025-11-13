// validators/enrollmentValidator.ts
import { z } from 'zod';
import type { CreateEnrollmentInput, UpdateProgressInput } from '../types/enrollmentTypes.js';

/**
 * Create Enrollment Schema
 * - course: valid ObjectId string
 */
export const createEnrollmentSchema = z.object({
  course: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid course ID format')
    .refine(
      async (id) => {
        const course = await import('../models/courseModel.js').then(m => m.Course);
        const doc = await course.findById(id).select('status');
        return doc && doc.status === 'published';
      },
      { message: 'Course not found or not published' }
    ),
}) satisfies z.ZodType<CreateEnrollmentInput>;

/**
 * Update Progress Schema
 * - lessonId: valid ObjectId string
 */
export const updateProgressSchema = z.object({
  lessonId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid lesson ID format'),
}) satisfies z.ZodType<UpdateProgressInput>;

/**
 * Query Schema for getMyEnrollments / getAllEnrollments
 */
export const enrollmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sort: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^(-?)(progress|enrolledAt|status|course\.title)$/.test(val),
      'Invalid sort field'
    ),
  fields: z.string().optional(),
  search: z.string().trim().min(2).optional(),

  // Filters
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  'progress[gte]': z.coerce.number().min(0).max(100).optional(),
  'progress[lte]': z.coerce.number().min(0).max(100).optional(),
  course: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

/**
 * Admin-only: Advanced filtering
 */
export const adminEnrollmentQuerySchema = enrollmentQuerySchema.extend({
  user: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  'course.instructor': z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  'enrolledAt[gte]': z.coerce.date().optional(),
  'enrolledAt[lte]': z.coerce.date().optional(),
});