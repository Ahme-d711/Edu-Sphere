import type { Document, Model, Types } from "mongoose";

// === Interfaces ===

export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  category: Types.ObjectId ;
  thumbnail: string;
  price: number;
  discountPrice?: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'published' | 'archived';
  instructor: Types.ObjectId;
  enrolledStudents: Types.ObjectId[];
  lessonsCount: number;
  duration: number;
  averageRating: number;
  ratingCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  finalPrice: number;
  discountPercentage: number;
}

export interface TransformableCourse {
  _id?: unknown;
  id?: string;
  __v?: number;
  isActive?: boolean;
  enrolledStudents?: unknown[];
}

// === Methods ===
export interface ICourseMethods {
  calculateAverageRating(): Promise<void>;
  updateStats(): Promise<void>;
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

// === Statics ===
export interface ICourseStatics {
  // eslint-disable-next-line no-unused-vars
  findBySlug(slug: string): Promise<ICourse | null>;
}

// === Model Type ===
export type ICourseModel = Model<ICourse, Record<string, never>, ICourseMethods> &
  ICourseStatics;
