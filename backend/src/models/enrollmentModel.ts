/**
 * Enrollment Schema - Production Ready
 * Features:
 * - Unique enrollment per user/course
 * - Progress tracking + completion logic
 * - Auto-populate course + instructor
 * - Virtuals: isCompleted, completionRate
 * - Stats sync on course & instructor
 * - Soft delete support (optional)
 */
import mongoose, { Schema, type Query } from 'mongoose';
import type { IEnrollment, IEnrollmentModel } from '../types/enrollmentTypes.js';
import { Course } from './courseModel.js';

const enrollmentSchema = new Schema<IEnrollment, IEnrollmentModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    progress: {
      type: Number,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100'],
      default: 0,
      set: (v: number) => Math.round(v * 10) / 10, // 1 decimal
    },
    completedLessons: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Lesson',
      },
    ],
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
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
  return r;
};

// === Indexes ===
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });
enrollmentSchema.index({ user: 1, status: 1 });
enrollmentSchema.index({ isActive: 1 });

// === Virtuals ===
enrollmentSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed' || this.progress >= 100;
});

enrollmentSchema.virtual('completionRate').get(function () {
  return this.progress;
});

// === Middleware: Auto-populate ===
enrollmentSchema.pre<Query<IEnrollment[], IEnrollment>>(/^find/, function (next) {
  this.populate([
    {
      path: 'course',
      select: 'title slug thumbnail price finalPrice level status instructor',
      populate: {
        path: 'instructor',
        select: 'title ratingAverage totalStudents',
        populate: { path: 'user', select: 'name profilePicture' },
      },
    },
    {
      path: 'completedLessons',
      select: 'title order duration',
    },
  ]);
  next();
});

// Soft delete filter
enrollmentSchema.pre<Query<IEnrollment[], IEnrollment>>(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// === Post-save: Update course & instructor stats ===
enrollmentSchema.post('save', async function (doc) {
  await updateRelatedStats(doc);
});

enrollmentSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) await updateRelatedStats(doc);
});

enrollmentSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await updateRelatedStats(doc, true);
});

// === Helper: Update stats ===
// eslint-disable-next-line no-unused-vars
async function updateRelatedStats(enrollment: IEnrollment, isDelete = false) {
  const CourseModel = mongoose.model('Course');
  const InstructorModel = mongoose.model('Instructor');

  const course = await CourseModel.findById(enrollment.course);
  if (course && typeof course.updateStats === 'function') {
    await course.updateStats();
  }

  const instructor = await InstructorModel.findOne({ _id: course?.instructor });
  if (instructor && typeof instructor.updateTotalStudents === 'function') {
    await instructor.updateTotalStudents();
  }
}

// === Instance Methods ===
enrollmentSchema.methods.markLessonCompleted = async function (lessonId: mongoose.Types.ObjectId) {
  if (this.completedLessons.includes(lessonId)) return;

  this.completedLessons.push(lessonId);
  const lesson = await mongoose.model('Lesson').findById(lessonId).select('course');
  if (!lesson || lesson.course.toString() !== this.course.toString()) {
    throw new Error('Invalid lesson for this enrollment');
  }

  const totalLessons = await mongoose.model('Lesson').countDocuments({ course: this.course });
  this.progress = Math.round((this.completedLessons.length / totalLessons) * 100 * 10) / 10;

  if (this.progress >= 100) {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  await this.save();
  await updateRelatedStats(this as IEnrollment);
};

enrollmentSchema.methods.softDelete = async function () {
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
  await updateRelatedStats(this as IEnrollment, true);
};

enrollmentSchema.methods.restore = async function () {
  this.isActive = true;
  await this.save({ validateBeforeSave: false });
  await updateRelatedStats(this as IEnrollment);
};

// === Static Methods ===
enrollmentSchema.statics.findByUserAndCourse = function (
  this: IEnrollmentModel,
  userId: mongoose.Types.ObjectId,
  courseId: mongoose.Types.ObjectId
): Promise<IEnrollment | null> {
  return this.findOne({ user: userId, course: courseId, isActive: true }) as Promise<IEnrollment | null>;
};

enrollmentSchema.methods.updateTotalStudents = async function () {
  const count = await Enrollment.countDocuments({
    course: { $in: await Course.find({ instructor: this._id }).distinct('_id') },
    status: 'active',
    isActive: true,
  });
  this.totalStudents = count;
  await this.save({ validateBeforeSave: false });
};


export const Enrollment: IEnrollmentModel =
  (mongoose.models.Enrollment as IEnrollmentModel) ||
  mongoose.model<IEnrollment, IEnrollmentModel>('Enrollment', enrollmentSchema);