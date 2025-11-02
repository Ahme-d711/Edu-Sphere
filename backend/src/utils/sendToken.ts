import type { Response } from 'express';
import { generateToken } from './jwt.js';
import type { IUser } from '../types/userTypes.js';
import ms from 'ms';

/**
 * Sends JWT token + user data (without sensitive fields)
 * @param user - Mongoose user document
 * @param statusCode - HTTP status
 * @param res - Express response
 */
export const createSendToken = (
  user: IUser,
  statusCode: number,
  res: Response
): void => {
  const token = generateToken(user._id.toString());

  // استخدام toJSON() لتفعيل transform من الـ schema
  const userResponse = user.toJSON();

  // إعدادات الكوكيز (آمنة في الإنتاج)
  const expiresIn = (process.env['JWT_COOKIE_EXPIRES_IN'] || '1d') as Parameters<typeof ms>[0];
  const cookieOptions = {
    expires: new Date(Date.now() + ms(expiresIn)),
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };

  res.cookie('edu_token', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    data: {
      token, // للـ API clients
      user: userResponse,
    },
  });
};