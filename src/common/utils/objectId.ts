import mongoose from 'mongoose';
import { z } from 'zod';

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

export const zObjectId = z
  .string()
  .trim()
  .refine((val) => isValidObjectId(val), {
    message: 'Invalid ObjectId',
  });
