import type { Types } from 'mongoose';
import type mongoose from 'mongoose';
import type { Document } from 'mongoose';

export interface ILesson extends Document {
  _id: Types.ObjectId;
  id: string;
  title: string;
  content?: string;
  videoUrl?: string;
  videoPublicId: string,
  thumbnailPublicId: string,
  duration: number;
  order: number;
  isFreePreview: boolean;
  isActive: boolean;
  course: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransformableLesson {
  _id?: unknown;
  id?: string;
  __v?: number;
  isActive?: boolean;
}

export interface ILessonMethods {
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

export type ILessonModel = mongoose.Model<ILesson, object, ILessonMethods>;
