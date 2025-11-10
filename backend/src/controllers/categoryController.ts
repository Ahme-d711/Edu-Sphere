import type { Query } from "mongoose";
import { Category } from "../models/categoryModel.js";
import { categoryQuerySchema, createCategorySchema, updateCategorySchema } from "../schemas/categorySchemas.js";
import { restoreCategoryService } from "../service/categoryService.js";
import type { ICategory } from "../types/categoryTypes.js";
import ApiFeatures from "../utils/ApiFeatures.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Request, Response, NextFunction } from 'express';


/**
 * Create new category (admin only)
 * @route   POST /api/categories
 * @access  Private (admin)
 */
export const createCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validate input with Zod
    const result = createCategorySchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const { name, description, icon } = result.data;

    // 2. Check for duplicate name (case-insensitive)
    const existing = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
    });

    if (existing) {
      return next(AppError.conflict('Category with this name already exists'));
    }

    // 3. Create category
    const category = await Category.create({
      name: name.toLowerCase(), // توحيد
      description,
      icon,
    });

    res.status(201).json({
      status: 'success',
      data: { category },
    });
  }
);

/**
 * Get all categories (with filtering, search, pagination, sorting)
 * @route   GET /api/categories
 * @access  Public
 */
export const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validate query params
  const queryParams = categoryQuerySchema.parse(req.query);
  
  const baseQuery = Category.find() as unknown as Query<ICategory[], ICategory>;

  // 2. Build features
  const features = new ApiFeatures(baseQuery, queryParams)
    .filter()
    .search(['name', 'description'])
    .sort()
    .select()
    .paginate();

  // 3. Execute
  const { results: categories, pagination } = await features.execute();

  res.status(200).json({
    status: 'success',
    results: categories.length,
    pagination,
    data: { categories },
  });
});

/**
 * Get single category by Slug
 * @route   GET /api/categories
 * @access  Public
 */
export const getCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {

    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return next(AppError.notFound('Category not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { category },
    });
  }
);

/**
 * Update category by ID (or slug) – Admin only
 * @route   PATCH /api/categories/:id
 * @access  Private (admin)
 */
export const updateCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {

    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(AppError.notFound('Category not found'));
    }

    // 2. Validate input
    const result = updateCategorySchema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message));
    }

    const { name, description, icon } = result.data;

    // 3. Prevent name duplication (case-insensitive, ignore current)
    if (name && name.toLowerCase() !== category.name.toLowerCase()) {
      const exists = await Category.findOne({
        name: { $regex: `^${name}$`, $options: 'i' },
        _id: { $ne: category._id },
      });

      if (exists) {
        return next(AppError.conflict('Category with this name already exists'));
      }
    }

    // 4. Update
    const updatedCategory = await Category.findByIdAndUpdate(
      category._id,
      {
        ...(name && { name: name.toLowerCase() }),
        description,
        icon,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      status: 'success',
      data: { category: updatedCategory },
    });
  }
);

/**
 * Soft delete category (admin only)
 * @route   DELETE /api/categories/:id
 * @access  Private (admin)
 */
export const deleteCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {

    const category = await Category.findById(req.params.id).select('+isActive');
    if (!category) {
      return next(AppError.notFound('Category not found'));
    }

    if (!category.isActive) {
      return next(AppError.badRequest('Category is already deleted'));
    }

    // 2. Use instance method with safety check
    try {
      await category.softDelete();
    } catch (error) {
      return next(AppError.badRequest((error as Error).message));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }
);

/**
 * Restore soft-deleted category (admin only)
 * @route   PATCH /api/categories/:id/restore
 * @access  Private (admin)
 */
export const restoreCategory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    
    const category = await restoreCategoryService(req.params.id as string);

    if (!category) {
      return next(AppError.notFound('Category not found'));
    }

    if (category.isActive) {
      return next(AppError.badRequest('Category is already active'));
    }

    // 2. Restore
    await category.restore();

    res.status(200).json({
      status: 'success',
      message: 'Category restored successfully',
      data: { category },
    });
  }
);