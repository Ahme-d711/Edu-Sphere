// src/types/categoryTypes.ts

import type { Document, Model, PopulateOptions } from 'mongoose';

/**
 * Category Document Interface
 */
export interface ICategory extends Document {
  // Fields
  name: string;
  slug: string;
  description?: string;
  icon: string;
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  courseCount?: number;

  // Methods
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

/**
 * Category Methods Interface
 */
export interface ICategoryMethods {
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

/**
 * Category Model Interface (Static Methods)
 */
export interface ICategoryModel extends Model<ICategory, object, ICategoryMethods> {
  // eslint-disable-next-line no-unused-vars
  findBySlug(slug: string): Promise<ICategory | null>;
}

/**
 * Category Response DTO (for API)
 */
export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Category Input (Admin)
 */
export interface CreateCategoryInput {
  name: string;
  description?: string;
  icon?: string;
}

/**
 * Update Category Input (Admin)
 */
export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
}

/**
 * Category Query Params (for filtering)
 */
export interface CategoryQueryParams {
  search?: string;
  page?: string | number;
  limit?: string | number;
  sort?: string;
  fields?: string;
}

/**
 * Populate options for category
 */
export const categoryPopulateOptions: PopulateOptions = {
  path: 'courseCount',
  select: 'courseCount',
};

export interface TransformableCategory {
  _id?: unknown;
  id?: string;
  __v?: number;
  isActive?: boolean;
}