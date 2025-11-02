import type { Document } from "mongoose";
import type mongoose from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  profilePic?: string;
  active?: boolean;
  role: 'admin' | 'student' | 'instructor';
  gender: 'male' | 'female' | 'other';
  isVerified?: boolean;
  passwordResetToken?: string ;
  passwordResetExpires?: Date ;
  createdAt?: Date;
  updatedAt?: Date;
  passwordChangedAt?: Date;
}

export type TransformableUser = Partial<IUser> & {
  __v?: number;
  password?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
};

export interface IUserMethods {
  // eslint-disable-next-line no-unused-vars
  comparePassword(candidate: string): Promise<boolean>;
  generateResetToken(): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type IUserModel = mongoose.Model<IUser, {}, IUserMethods>;
