import { z } from 'zod';

// === User Creation / Update Schema ===
export const userValidationSchema = z.object({
  name: z
    .string('Name is required')
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),

  userName: z
    .string('user name is required')
    .trim()
    .min(2, 'user name must be at least 2 characters')
    .max(50, 'user name cannot exceed 50 characters'),

  email: z
    .string('Email is required')
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),

  password: z
    .string('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),

  phoneNumber: z
    .string('Phone number is required')
    .regex(/^\+?[\d\s\-()]{10,}$/, 'Please enter a valid phone number'),

  gender: z.enum(['male', 'female', 'other'], {
    message: 'Gender must be male, female, or other',
  }),

  role: z
    .enum(['admin', 'student', "instructor"])
    .default('student')
    .optional(),
}).strict(); // لا بيانات إضافية

export const loginSchema = z.object({
  email: z
    .string('Email is required')
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),

  password: z
    .string('Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

// === Query Schema (Pagination + Filtering + Sorting) ===
const sortableFields = ['name', 'createdAt', 'email', 'userName'] as const;
type SortField = typeof sortableFields[number];

export const userQuerySchema = z.object({
  role: z
    .enum(['admin', 'student', 'instructor'])
    .optional()
    .transform((val) => (val ? [val] : undefined)), // لدعم array في Mongoose

  page: z
    .coerce
    .number('Page must be a number')
    .positive('Page must be positive')
    .max(10000, 'Page is too large')
    .default(1),

  limit: z
    .coerce
    .number('Limit must be a number')
    .int()
    .min(1)
    .max(100, 'Limit cannot exceed 100')
    .default(10),

  sort: z
    .string()
    .optional()
    .transform((val): SortField | `- ${SortField}` | undefined => {
      if (!val) return undefined;
      const fields = val.split(',').map(f => f.trim());
      const valid = fields.every(f => 
        sortableFields.includes(f.replace(/^-/, '') as SortField)
      );
      return valid ? (val as SortField | `- ${SortField}`) : undefined;
    })
    .refine((val) => val !== null, 'Invalid sort field')
    .catch(undefined),
}).catchall(z.string().or(z.array(z.string())).or(z.number()).optional());


// === Types ===
export type UserInput = z.infer<typeof userValidationSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;

// === Partial Update Schema (PATCH) ===
export const userUpdateSchema = userValidationSchema
  .omit({ password: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided for update'
  );

  export const userIdSchema = z.object({
    userId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'User ID must be a valid MongoDB ObjectId'),
  });

  export type UserIdType = z.infer<typeof userIdSchema>;
