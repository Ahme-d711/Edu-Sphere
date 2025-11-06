// src/middlewares/globalError.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

// تفعيل/تعطيل stack trace بناءً على البيئة
const isDev = process.env['NODE_ENV'] !== 'production';

type MongooseLikeError = {
  name?: string;
  code?: number;
  path?: string;
  value?: unknown;
  message?: string;
  stack?: string;
  errors?: Record<string, { message: string }>;
  keyValue?: Record<string, unknown>;
};

const isMongooseLikeError = (err: unknown): err is MongooseLikeError => {
  if (!err || typeof err !== 'object') return false;
  const e = err as MongooseLikeError;
  return (
    typeof e.name === 'string' ||
    typeof e.code === 'number'
  );
};

const handleMongooseError = (err: unknown): AppError => {
  const e = (err as MongooseLikeError) || {};
  if (e.name === 'CastError' && e.path) {
    return AppError.badRequest(`Invalid ${e.path}: ${String(e.value)}`);
  }
  if (e.name === 'ValidationError' && e.errors) {
    const messages = Object.values(e.errors).map((x) => x.message).join(', ');
    return AppError.badRequest(`Validation failed: ${messages}`);
  }
  if (e.code === 11000 && e.keyValue) {
    const keyValue = e.keyValue as Record<string, unknown>;
    const keys = Object.keys(keyValue);
    if (keys.length > 0) {
      const field = keys[0] as keyof typeof keyValue;
      const value = keyValue[field];
      return AppError.badRequest(`Duplicate field: ${String(field)} = ${String(value)}`);
    }
    return AppError.badRequest('Duplicate key');
  }
    console.error('⚠️ Unknown Mongoose error:', err);
  return AppError.badRequest('Invalid request data');
};

export const globalError = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  void _next;

  // ✅ إذا تم إرسال الرد بالفعل — لا تحاول الرد مرة أخرى
  if (res.headersSent) {
    console.warn('⚠️ Headers already sent — skipping globalError response');
    return;
  }

  // 1. تحويل أخطاء Mongoose
  if (isMongooseLikeError(err) && (err.name?.startsWith('Mongo') || err.name === 'ValidationError' || err.code === 11000)) {
    err = handleMongooseError(err);
  }

  // 2. ضمان وجود AppError
  const error =
    err instanceof AppError
      ? err
      : process.env['NODE_ENV'] === 'development'
      ? new AppError(err instanceof Error ? err.message : 'Unknown error', 500)
      : new AppError('Something went wrong', 500);

  // 3. تسجيل الأخطاء
  if (!error.isOperational) {
    const e = err as MongooseLikeError;
    console.error('🚨 UNHANDLED ERROR:', isDev ? e.stack : e.message);
  }

  // 4. الرد النهائي
  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    ...(isDev && error.isOperational && { stack: error.stack }),
  });
};
