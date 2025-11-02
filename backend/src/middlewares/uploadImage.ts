import multer, { type FileFilterCallback, type Field, MulterError } from 'multer';
import type { NextFunction, Request } from 'express';
import { AppError } from '../utils/AppError.js';
import type { MulterFile } from '../types/express-multer.js';

// === Configuration ===
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: MulterFile,
  cb: FileFilterCallback
): void => {
  // 1. تحقق من نوع الملف
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
    return cb(AppError.badRequest('Invalid file type. Only JPEG, PNG, WebP, GIF allowed.'));
  }

  // 2. تحقق من الامتداد (أمان إضافي)
  const ext = file.originalname.toLowerCase().split('.').pop();
  const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!ext || !validExts.includes(ext)) {
    return cb(AppError.badRequest('Invalid file extension.'));
  }

  cb(null, true);
};

// === Multer Instance ===
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // حد أقصى ملف واحد لكل طلب
  },
});

// === Middleware Wrappers ===
export const uploadSingle = (fieldName: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: Request, _res: any, next: NextFunction) =>
    upload.single(fieldName)(req, _res , (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(AppError.badRequest('File too large. Max 10MB allowed.'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(AppError.badRequest('Too many files.'));
        }
        return next(AppError.badRequest(err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
};

export const uploadArray = (fieldName: string, maxCount: number = 5) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: Request, _res: any, next: NextFunction) =>
    upload.array(fieldName, maxCount)(req, _res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(AppError.badRequest('One or more files exceed 10MB.'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(AppError.badRequest(`Max ${maxCount} files allowed.`));
        }
        return next(AppError.badRequest(err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
};

export const uploadFields = (fields: Field[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: Request, _res: any, next: NextFunction) =>
    upload.fields(fields)(req, _res, (err: unknown) => {
      if (err instanceof MulterError) {
        return next(AppError.badRequest(err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
};