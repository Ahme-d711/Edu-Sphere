import mongoose, { Schema, type Query } from 'mongoose';
import type { ICourse, ICourseMethods, ICourseModel } from '../types/courseTypes.js';
import crypto from 'crypto';


const courseSchema = new Schema<ICourse, ICourseModel, ICourseMethods>(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    thumbnail: {
      type: String,
      default: `${process.env.CLIENT_URL}/images/default-course-thumb.jpg`,
      validate: {
        validator: (v: string) => /^https?:\/\//.test(v),
        message: 'Thumbnail must be a valid URL',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price must be positive'],
      validate: {
        validator: function (this: ICourse, val: number) {
          return !val || val < this.price;
        },
        message: 'Discount price must be less than original price',
      },
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: 'Instructor',
      required: [true, 'Instructor is required'],
      index: true,
    },
    enrolledStudents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lessonsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number, // in minutes
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be >= 0'],
      max: [5, 'Rating must be <= 5'],
      set: (val: number) => Math.round(val * 10) / 10,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
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
      transform: transformFn
    },
    toObject: { virtuals: true },
  }
);

// === Indexes ===
courseSchema.index({ title: 'text', description: 'text' }, { weights: { title: 10, description: 5 } });
courseSchema.index({ status: 1, isActive: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ averageRating: -1 });
courseSchema.index({ instructor: 1, status: 1 });
courseSchema.index({ category: 1, status: 1 });

function transformFn(_doc: unknown, ret: Record<string, unknown>) {
  type MutableCourseTransform = Record<string, unknown> & {
    _id?: { toString(): string };
    id?: string;
    __v?: unknown;
    isActive?: unknown;
    enrolledStudents?: unknown;
  };
  const r = ret as MutableCourseTransform;
  r.id = r._id?.toString();
  delete r._id;
  delete r.__v;
  delete r.isActive;
  delete r.enrolledStudents;
  return r;
};

// === Virtuals ===
courseSchema.virtual('finalPrice').get(function () {
  return this.discountPrice ?? this.price;
});

courseSchema.virtual('discountPercentage').get(function () {
  if (!this.discountPrice) return 0;
  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

courseSchema.virtual('isDiscounted').get(function () {
  return !!this.discountPrice;
});

// === Middleware ===
courseSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    this.slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
  }
  next();
});

// Exclude soft-deleted courses
courseSchema.pre<Query<ICourse[], ICourse>>(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// Populate instructor & category on find
courseSchema.pre<Query<ICourse[], ICourse>>(/^find/, function (next) {
  this.populate([
    {
      path: 'instructor',
      select: 'title ratingAverage totalStudents',
      populate: {
        path: 'user',
        select: 'name profilePicture',
      },
    },
    {
      path: 'category',
      select: 'name slug',
    },
  ]);
  next();
});

// === Methods ===
courseSchema.methods.calculateAverageRating = async function () {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { course: this._id, isActive: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  this.averageRating = stats[0]?.averageRating || 0;
  this.ratingCount = stats[0]?.ratingCount || 0;

  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.updateStats = async function () {
  const [Lesson, Enrollment] = [mongoose.model('Lesson'), mongoose.model('Enrollment')];

  const [lessonCount, , uniqueStudents] = await Promise.all([
    Lesson.countDocuments({ course: this._id }),
    Enrollment.countDocuments({ course: this._id }),
    Enrollment.distinct('user', { course: this._id }),
  ]);

  this.lessonsCount = lessonCount;
  this.enrolledStudents = uniqueStudents;

  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.softDelete = async function () {
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
};

courseSchema.methods.restore = async function () {
  this.isActive = true;
  await this.save({ validateBeforeSave: false });
};

// === Static Methods ===
courseSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug, isActive: true });
};

const CourseModel = mongoose.model('Course', courseSchema as unknown as Schema) as unknown as ICourseModel;
export const Course = CourseModel;

