import jwt from 'jsonwebtoken';
import { AppError } from "./AppError.js";

/**
 * Generates a JWT token for a user
 * @param userId - The user's ID
 * @returns JWT token
 */
export const generateToken = (userId: string): string => {
  const secret = process.env['JWT_SECRET'];
  const expiresIn = process.env['JWT_EXPIRES_IN'] || '1d';
  const algorithm = (process.env['JWT_ALGORITHM'] as 'HS256' | 'HS384' | 'HS512') || 'HS256';

  if (!secret) {
    throw AppError.badRequest('JWT_SECRET is not defined');
  }

  try {
    return jwt.sign({ id: userId }, secret, {
      expiresIn,
      algorithm,
    } as jwt.SignOptions);
  } catch {
    throw AppError.badRequest('Failed to sign JWT token');
  }
};