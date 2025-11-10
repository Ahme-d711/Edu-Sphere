// validators/categoryValidator.ts
import { z } from 'zod';
import type { CreateCategoryInput, UpdateCategoryInput } from '../types/categoryTypes.js';

/**
 * Create Category Schema
 * - name: required, unique (handled by DB)
 * - description: optional, max 200 chars
 * - icon: optional, must be valid URL
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(3, 'Category name must be at least 3 characters')
    .max(50, 'Category name cannot exceed 50 characters')
    .trim()
    .refine(
      (val) => val.toLowerCase() === val,
      'Category name must be lowercase (will be normalized)'
    ),
  description: z
    .string()
    .max(200, 'Description cannot exceed 200 characters')
    .trim()
    .optional(),
  icon: z
    .string()
    .url('Icon must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
}) satisfies z.ZodType<CreateCategoryInput>;

export const categoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt', 'courseCount', '-courseCount']).optional(),
  fields: z.string().optional(),
  search: z.string().trim().min(1).optional(),
  'courseCount[gte]': z.coerce.number().min(0).optional(),
  'courseCount[lte]': z.coerce.number().min(0).optional(),
});

/**
 * Update Category Schema
 * - At least one field required
 * - Same rules as create, but all optional
 */
export const updateCategorySchema = createCategorySchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  ) satisfies z.ZodType<UpdateCategoryInput>;

// === Helper Types ===
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;