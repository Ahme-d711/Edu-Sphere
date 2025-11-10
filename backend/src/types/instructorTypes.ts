import type { Document } from 'mongoose';
import type { IUser } from './userTypes.js';

/**
 * Interface: Instructor
 */
export interface IInstructor extends Document {
  user: IUser['_id']; // ref to User
  title: string;
  bio?: string;
  expertise: string[];
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    youtube?: string;
  };
  ratingAverage: number;
  ratingCount: number;
  totalStudents: number;
  totalCourses: number;
  isActive:boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  ratingDisplay: string;

  // Methods
  updateStats(): Promise<void>;
  restore(): Promise<void>;
}