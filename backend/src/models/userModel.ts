import { model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';
import { userValidationSchema } from '../schemas/userSchemas.js';
import type { IUser, IUserMethods, IUserModel } from '../types/userTypes.js';
import type { Query } from 'mongoose';

// === Schema ===
const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    userName: {
      type: String,
      required: [true, 'Name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^\S+@\S+\.\S+$/.test(v),
        message: 'Please enter a valid email address',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: {
        validator: (v: string) => /^\+?[\d\s\-()]{10,}$/.test(v),
        message: 'Please enter a valid phone number',
      },
    },
    profilePic: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'student', 'instructor'], default: 'student' },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['male', 'female', 'other'] as const,
    },
    active: { type: Boolean, default: true },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: {type: Date, select: false}
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: transformFn },
    toObject: { virtuals: true },
  }
);


// === Transform (إزالة _id, __v, password) ===
function transformFn(_doc: unknown, ret: Record<string, unknown>) {
  delete ret.__v;
  delete ret.password;
  delete ret.passwordResetToken;
  delete ret.passwordResetExpires;
  return ret;
}

// === Pre-save: Hash Password ===
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (!this.password) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000); // -1s لتجنب التأخير
    next();
});

// // ✅ Middleware: استبعاد المستخدمين غير النشطين
userSchema.pre<Query<IUser[], IUser>>(/^find/, function (next) {
  if ((this).getQuery().includeInactive) return next();

  this.find({ active: { $ne: false } });
  next();
});

// === Method: Compare Password (مع +select) ===
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password ?? '');
};

// === Method: Generate Reset Token + Save ===
userSchema.methods.generateResetToken = async function (): Promise<string> {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  return resetToken;
};

// === Static: Validate with AppError ===
userSchema.statics['validateUser'] = (data: Partial<IUser>) => {
  const result = userValidationSchema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((e) => e.message).join(', ');
    throw AppError.badRequest(message);
  }
  return result.data;
};

// === Model ===
const UserModel = model('User', userSchema as unknown as Schema) as unknown as IUserModel;

export default UserModel;