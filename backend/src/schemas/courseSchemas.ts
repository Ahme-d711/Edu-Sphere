import z from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(5).max(150),
  description: z.string().min(20).max(2000),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  price: z.number().min(0),
  discountPrice: z.number().min(0).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  thumbnail: z.string().url().optional(),
}).refine(
  data => !data.discountPrice || data.discountPrice < data.price,
  { message: 'Discount price must be less than price', path: ['discountPrice'] }
);

export const updateCourseSchema = z
  .object({
    title: z.string().min(5).max(150).optional(),
    description: z.string().min(20).max(2000).optional(),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    price: z.number().min(0).optional(),
    discountPrice: z.number().min(0).optional(), // Remove the individual refine here
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    thumbnail: z.string().url().optional(),
  })
  .refine(
    (data) => {
      // Global refine to validate discountPrice against price
      if (data.discountPrice !== undefined && data.price !== undefined) {
        return data.discountPrice < data.price;
      }
      return true; // No validation needed if either is undefined
    },
    {
      message: 'Discount price must be less than price',
      path: ['discountPrice'],
    }
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const courseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sort: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^(-?)(title|price|averageRating|createdAt|duration)$/.test(val),
      'Invalid sort field'
    ),
  fields: z.string().optional(),
  search: z.string().trim().min(2).optional(),

  // Filters
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  'price[gte]': z.coerce.number().min(0).optional(),
  'price[lte]': z.coerce.number().min(0).optional(),
  'averageRating[gte]': z.coerce.number().min(0).max(5).optional(),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  instructor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  'duration[gte]': z.coerce.number().min(0).optional(),
  'duration[lte]': z.coerce.number().min(0).optional(),
});
