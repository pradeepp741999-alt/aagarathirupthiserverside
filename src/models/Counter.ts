import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const Counter = mongoose.model<ICounter>('Counter', counterSchema, 'counters');
