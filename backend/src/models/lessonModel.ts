import mongoose, { Schema, type Query } from 'mongoose';
import type { ILesson, ILessonMethods, ILessonModel, TransformableLesson } from '../types/lessonTypes.js';

const lessonSchema = new Schema<ILesson, ILessonModel, ILessonMethods>(
  {
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters'],
    },
    videoUrl: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^https?:\/\/.+/i.test(v),
        message: 'Video URL must be a valid HTTPS/HTTP link',
      },
    },
    videoPublicId: String,
    thumbnailPublicId: String,
    duration: {
      type: Number,
      default: 0,
      min: [0, 'Duration cannot be negative'],
    },
    order: {
      type: Number,
      default: 0,
      min: [0, 'Order cannot be negative'],
    },
    isFreePreview: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Lesson must belong to a course'],
      index: true,
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

// === Indexes ===
lessonSchema.index({ course: 1, order: 1 }, { unique: true });
lessonSchema.index({ course: 1, isActive: 1 });
lessonSchema.index({ title: 'text', content: 'text' }, { weights: { title: 10, content: 5 } });

// === Transform Function ===
function transformFn(_doc: unknown, ret: Record<string, unknown>) {
  const r = ret as TransformableLesson;
  r.id = r._id?.toString();
  delete r._id;
  delete r.__v;
  delete r.isActive;
  return r;
}

// === Query Middleware: Soft Delete Filter ===
lessonSchema.pre<Query<ILesson[],ILesson>>(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// === Auto-increment order on save (if not set) ===
lessonSchema.pre('save', async function (next) {
  if (this.isNew && this.order === 0) {
    const LessonModel = this.constructor as mongoose.Model<ILesson>;

    const lastLesson = await LessonModel.findOne({ course: this.course })
      .sort({ order: -1 })
      .select('order');

    this.order = lastLesson ? lastLesson.order + 1 : 1;
  }
  next();
});

// === Update Course stats on save/delete/restore ===
// eslint-disable-next-line no-unused-vars
const updateCourseStats = async function (this: ILesson) {
  const CourseModel = mongoose.model('Course');
  const course = await CourseModel.findById(this.course);
  if (course && typeof course.updateStats === 'function') {
    await course.updateStats();
  }
};

lessonSchema.post('save', updateCourseStats);
lessonSchema.post('findOneAndDelete', updateCourseStats);
lessonSchema.post('findOneAndUpdate', async function (doc: ILesson) {
  if (doc && (doc.isModified('isActive') || doc.isModified('duration'))) {
    await updateCourseStats.call(doc);
  }
});

// === Instance Methods ===
lessonSchema.methods.softDelete = async function () {
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
  await updateCourseStats.call(this);
};

lessonSchema.methods.restore = async function () {
  this.isActive = true;
  await this.save({ validateBeforeSave: false });
  await updateCourseStats.call(this);
};

// === Static Methods ===
lessonSchema.statics.reorderLessons = async function (courseId: mongoose.Types.ObjectId, newOrder: number[]) {
  const bulkOps = newOrder.map((lessonId, index) => ({
    updateOne: {
      filter: { _id: lessonId, course: courseId },
      update: { order: index + 1 },
    },
  }));

  await this.bulkWrite(bulkOps);
  const CourseModel = mongoose.model('Course');
  const course = await CourseModel.findById(courseId);
  if (course && typeof course.updateStats === 'function') {
    await course.updateStats();
  }
};

export const LessonModel = (mongoose.models.Lesson ||
  mongoose.model('Lesson', lessonSchema)) as unknown as ILessonModel;