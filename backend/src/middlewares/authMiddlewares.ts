import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import UserModel from '../models/userModel.js';
import type { Request, Response, NextFunction } from 'express';
import type { IUser } from '../types/userTypes.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// === Extend Request type ===
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: IUser;
    }
  }
}

//Types
interface JwtPayload {
  id: string;
  iat: number;
}

/**
 * Protect routes - verify JWT and attach user
 */
export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  // 1. Get token
  const token = req.cookies['edu_token'] || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(AppError.unauthorized('You are not logged in'));
  } 

  // 2. Verify token
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    return next(AppError.badRequest('JWT secret is missing'));
  }

  let decoded: { id: string; iat: number };
  try {
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return next(AppError.unauthorized('Token has expired'));
    }
    if (err instanceof JsonWebTokenError) {
      return next(AppError.unauthorized('Invalid token'));
    }
    return next(AppError.unauthorized('Token verification failed'));
  }

  // 3. Check if user exists
  const user = await UserModel.findById(decoded.id).select('+passwordChangedAt +isActive');
  if (!user || !user.isActive) {
    return next(AppError.unauthorized('User no longer exists'));
  }

  // 4. Check if password changed after token issued
  if (user.passwordChangedAt) {
    const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (changedTimestamp > decoded.iat) {
      return next(AppError.unauthorized('Password changed. Please log in again'));
    }
  }

  // 5. Attach user to request
  req.user = user;
  next();
});


/**
 * Restrict access to specific roles
 * @example restrictTo('admin', 'trainer')
 */
export const restrictTo = (...allowedRoles: Array<IUser['role']>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    // 1. تأكد من وجود المستخدم (من protect middleware)
    if (!req.user) {
      return next(AppError.unauthorized('You are not logged in'));
    }

    // 2. تحقق من الصلاحية
    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }

    next();
  };