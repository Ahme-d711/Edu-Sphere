import z from "zod";

export const lessonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sort: z.enum(['order', '-order', 'createdAt', '-createdAt', 'duration', '-duration']).optional(),
  fields: z.string().optional(),
  search: z.string().trim().min(2).optional(),
  isFreePreview: z.enum(['true', 'false']).optional(),
  'duration[gte]': z.coerce.number().min(0).optional(),
  'duration[lte]': z.coerce.number().min(0).optional(),
});