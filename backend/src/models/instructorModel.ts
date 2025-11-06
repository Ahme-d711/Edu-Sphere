// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Schema, model, type Model, Query } from 'mongoose';
import type { IInstructor } from '../types/instructorTypes.js';
import type { IUser } from '../types/userTypes.js';

const instructorSchema = new Schema<IInstructor>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Instructor must belong to a user'],
      unique: true,
      index: true, // تحسين الأداء
    },
    title: {
      type: String,
      required: [true, 'Instructor title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    expertise: {
      type: [String],
      default: [],
    },
    socialLinks: {
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      youtube: { type: String, trim: true },
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be above 0'],
      max: [5, 'Rating must be below 5'],
      set: (val: number) => Math.round(val * 10) / 10,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCourses: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// === Indexes ===
instructorSchema.index({ title: 'text', bio: 'text' }, { weights: { title: 10, bio: 5 } });
instructorSchema.index({ expertise: 1 });
instructorSchema.index({ ratingAverage: -1 });
instructorSchema.index({ totalStudents: -1 });

// === Populate user + fallback profilePic ===
instructorSchema.pre<Query<IInstructor[], IInstructor>>(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name email profilePicture role gender',
    transform: (doc: Partial<IUser>) => {
      if (doc && !doc.profilePic) {
        doc.profilePic = `${process.env['CLIENT_URL']}/default-avatar.png`;
      }
      return doc;
    },
  });
  next();
});

// === Virtual: average rating display ===
instructorSchema.virtual('ratingDisplay').get(function () {
  return this.ratingCount > 0 ? `${this.ratingAverage} (${this.ratingCount})` : 'No ratings yet';
});

// === Methods ===
instructorSchema.methods.updateStats = async function () {
  const stats = await this.model('Course').aggregate([
    { $match: { instructor: this._id } },
    {
      $lookup: {
        from: 'enrollments',
        localField: '_id',
        foreignField: 'course',
        as: 'enrollments',
      },
    },
    {
      $group: {
        _id: null,
        totalCourses: { $sum: 1 },
        totalStudents: { $sum: { $size: '$enrollments' } },
      },
    },
  ]);

  if (stats[0]) {
    this.totalCourses = stats[0].totalCourses;
    this.totalStudents = stats[0].totalStudents;
  } else {
    this.totalCourses = 0;
    this.totalStudents = 0;
  }

  await this.save({ validateBeforeSave: false });
};

const InstructorModel: Model<IInstructor> = model<IInstructor>('Instructor', instructorSchema);
export default InstructorModel;