import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  mobile: string;
  name?: string | null;
  whatsapp?: string | null;
  altMobile?: string | null;
  district?: string | null;
  location?: string | null;
  geo?: {
    lat: number;
    lng: number;
  };
  avatarColor?: string | null;
  profileCompleted: boolean;
  status: 'active' | 'blocked';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      match: /^[6-9]\d{9}$/,
    },
    name: { type: String, default: null },
    whatsapp: { type: String, default: null },
    altMobile: { type: String, default: null },
    district: { type: String, default: null },
    location: { type: String, default: null },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    avatarColor: { type: String, default: null },
    profileCompleted: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema, 'users');
