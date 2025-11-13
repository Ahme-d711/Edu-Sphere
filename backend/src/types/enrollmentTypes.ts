// types/enrollmentTypes.ts
import type { Document, Types } from 'mongoose';
import type { ICourse } from './courseTypes.js';
import type { IUser } from './userTypes.js';
import type { ILesson } from './lessonTypes.js';
import type mongoose from 'mongoose';

/**
 * Main Enrollment Document Interface
 */
export interface IEnrollment extends Document {
  // Core Fields
  user: Types.ObjectId | IUser;
  course: Types.ObjectId | ICourse;
  completedLessons: Array<Types.ObjectId | ILesson>;
  
  status: 'active' | 'completed' | 'cancelled';
  progress: number;

  // Timestamps
  enrolledAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Soft Delete
  isActive: boolean;

  // === Virtuals ===
  isCompleted: boolean;
  completionRate: number;

  // === Instance Methods ===
  // eslint-disable-next-line no-unused-vars
  markLessonCompleted(lessonId: Types.ObjectId): Promise<void>;
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

/**
 * Enrollment Model Interface
 */
export interface IEnrollmentModel extends mongoose.Model<IEnrollment> {
  // === Static Methods ===
  findByUserAndCourse(
    // eslint-disable-next-line no-unused-vars
    userId: Types.ObjectId, courseId: Types.ObjectId
  ): Promise<IEnrollment | null>;
}

/**
 * DTOs for API Validation (Zod)
 */

/** Create Enrollment Input */
export interface CreateEnrollmentInput {
  course: string; // ObjectId as string
}

/** Update Progress Input */
export interface UpdateProgressInput {
  lessonId: string;
}

/** Response DTO (after transform) */
export interface EnrollmentResponse {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail?: string;
    price: number;
    finalPrice: number;
    level: string;
    status: string;
    instructor: {
      id: string;
      title: string;
      ratingAverage: number;
      totalStudents: number;
      user: {
        name: string;
        profilePicture?: string;
      };
    };
  };
  status: 'active' | 'completed' | 'cancelled';
  progress: number;
  completedLessons: Array<{
    id: string;
    title: string;
    order: number;
    duration: number;
  }>;
  enrolledAt: string; // ISO string
  completedAt?: string;
  isCompleted: boolean;
  completionRate: number;
  createdAt: string;
  updatedAt: string;
}