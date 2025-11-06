import { z } from 'zod';

export const instructorValidationSchema = z.object({
  user: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  title: z.string().min(3).max(100),
  bio: z.string().max(1000).optional(),
  expertise: z.array(z.string()).default([]),
  socialLinks: z
    .object({
      linkedin: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),
});


export const updateInstructorSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  bio: z.string().max(1000).optional(),
  expertise: z.array(z.string()).max(10).optional(),
  socialLinks: z
    .object({
      linkedin: z.string().url().optional(),
      twitter: z.string().url().optional(),
      youtube: z.string().url().optional(),
    })
    .optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const instructorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  fields: z.string().optional(),
  search: z.string().trim().min(1).optional(),
  expertise: z.union([z.string(), z.array(z.string())]).transform(val => 
    Array.isArray(val) ? val : val ? [val] : []
  ).optional(),
  'ratingAverage[gte]': z.coerce.number().min(0).max(5).optional(),
  'ratingAverage[lte]': z.coerce.number().min(0).max(5).optional(),
  'totalStudents[gte]': z.coerce.number().min(0).optional(),
}).refine(
  data => {
    if (data['ratingAverage[gte]'] && data['ratingAverage[lte]']) {
      return data['ratingAverage[gte]'] <= data['ratingAverage[lte]'];
    }
    return true;
  },
  { message: 'gte must be <= lte', path: ['ratingAverage[gte]'] }
);