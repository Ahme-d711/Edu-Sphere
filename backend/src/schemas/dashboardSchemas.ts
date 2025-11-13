import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'name', '-name']).optional(),
  fields: z.string().optional(),
});