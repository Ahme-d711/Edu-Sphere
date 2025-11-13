import multer, { type FileFilterCallback, MulterError, type Field } from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import type { MulterFile } from '../types/express-multer.js';

// === الإعدادات العامة ===
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB للفيديوهات
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] as const;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'] as const;

const storage = multer.memoryStorage();

/**
 * دالة لتصفية الملفات حسب نوعها (صور أو فيديو)
 */
const createFileFilter =
  (allowedTypes: readonly string[]) =>
  (_req: Request, file: MulterFile, cb: FileFilterCallback): void => {
    // تحقق من نوع الملف
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        AppError.badRequest(
          `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
        )
      );
    }

    // تحقق من الامتداد (تحقق إضافي)
    let ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'jpg') ext = 'jpeg'; // تحويل امتداد المستخدم
    
    const validExts = allowedTypes.map((type) => type.split('/')[1]);
    
    if (!ext || !validExts.includes(ext)) {
      return cb(AppError.badRequest('Invalid file extension.'));
    }

    cb(null, true);
  };

/**
 * إنشاء instance من multer بناءً على نوع الملفات المسموح بها
 */
const createUploader = (allowedTypes: readonly string[]) =>
  multer({
    storage,
    fileFilter: createFileFilter(allowedTypes),
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
    },
  });

/**
 * Middleware لرفع ملف واحد
 */
export const uploadSingle =
  (fieldName: string, type: 'image' | 'video' = 'image') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const allowedTypes =
      type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const uploader = createUploader(allowedTypes);

    uploader.single(fieldName)(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return next(AppError.badRequest('File too large.'));
          case 'LIMIT_FILE_COUNT':
            return next(AppError.badRequest('Too many files.'));
          default:
            return next(AppError.badRequest(err.message));
        }
      }
      if (err) return next(err);
      next();
    });
  };

/**
 * Middleware لرفع مجموعة ملفات
 */
export const uploadArray =
  (fieldName: string, maxCount = 5, type: 'image' | 'video' = 'image') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const allowedTypes =
      type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const uploader = createUploader(allowedTypes);

    uploader.array(fieldName, maxCount)(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return next(AppError.badRequest('One or more files too large.'));
          case 'LIMIT_FILE_COUNT':
            return next(AppError.badRequest(`Max ${maxCount} files allowed.`));
          default:
            return next(AppError.badRequest(err.message));
        }
      }
      if (err) return next(err);
      next();
    });
  };

/**
 * Middleware لرفع حقول متعددة
 */
export const uploadFields =
  (fields: Field[], type: 'image' | 'video' = 'image') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const allowedTypes =
      type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const uploader = createUploader(allowedTypes);

    uploader.fields(fields)(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        return next(AppError.badRequest(err.message));
      }
      if (err) return next(err);
      next();
    });
  };
