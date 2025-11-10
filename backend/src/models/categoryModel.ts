import mongoose, { Schema } from 'mongoose';
import type { ICategory, ICategoryMethods, ICategoryModel } from '../types/categoryTypes.js';
import type { Model, Query } from 'mongoose';

const categorySchema = new Schema<ICategory, ICategoryModel, ICategoryMethods>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    icon: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^https?:\/\//.test(v),
        message: 'Icon must be a valid URL',
      },
      default: `${process.env.CLIENT_URL}/icons/default-category.svg`,
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: transformFn,
    },
    toObject: { virtuals: true },
  }
);

function transformFn(_doc: unknown, ret: Record<string, unknown>) {
  type MutableCategoryTransform = Record<string, unknown> & {
    _id?: { toString(): string };
    id?: string;
    __v?: unknown;
    isActive?: unknown;
  };
  const r = ret as MutableCategoryTransform;
  r.id = r._id?.toString();
  delete r._id;
  delete r.__v;
  delete r.isActive;
  return r;
};

// === Indexes ===
categorySchema.index({ name: 'text', description: 'text' }, { weights: { name: 10, description: 5 } });
categorySchema.index({ isActive: 1 });

// === Virtuals ===
categorySchema.virtual('courseCount', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'category',
  count: true,
});

// === Middleware ===
categorySchema.pre('save', async function (next) {
  if (this.isModified('name')) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const CategoryModel = this.constructor as Model<ICategory>; // ✅ نخبر TS أنه موديل

    let slug = `${baseSlug}-${Date.now().toString(36)}`;
    let exists = await CategoryModel.findOne({ slug });
    let counter = 1;

    while (exists) {
      slug = `${baseSlug}-${Date.now().toString(36)}-${counter}`;
      exists = await CategoryModel.findOne({ slug });
      counter++;
    }

    this.slug = slug;
  }
  next();
});

// Exclude soft-deleted categories
categorySchema.pre<Query<ICategory[], ICategory>>(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});


// === Methods ===
categorySchema.methods.softDelete = async function () {
  // Prevent deletion if courses exist
  const courseCount = await mongoose.model('Course').countDocuments({ category: this._id });
  if (courseCount > 0) {
    throw new Error('Cannot delete category with active courses');
  }

  this.isActive = false;
  await this.save({ validateBeforeSave: false });
};

categorySchema.methods.restore = async function () {
  this.isActive = true;
  await this.save({ validateBeforeSave: false });
};

// === Static Methods ===
categorySchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug, isActive: true });
};

const CategoryModel = (mongoose.models.Category ||
  (mongoose.model('Category', categorySchema as unknown as Schema) as unknown)) as unknown as ICategoryModel;
export const Category = CategoryModel;

