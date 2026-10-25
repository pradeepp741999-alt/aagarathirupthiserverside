import mongoose, { Schema, Document } from 'mongoose';

export interface IDistrictArea {
  name: string;
  type: 'locality' | 'taluk';
  lat?: number;
  lng?: number;
}

export interface IDistrict extends Document<string> {
  _id: string; // slug e.g. 'salem'
  name: string;
  isDefault: boolean;
  lat?: number;
  lng?: number;
  areas: IDistrictArea[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const districtSchema = new Schema<IDistrict>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    lat: { type: Number },
    lng: { type: Number },
    areas: [
      {
        name: { type: String, required: true },
        type: { type: String, enum: ['locality', 'taluk'], required: true },
        lat: { type: Number },
        lng: { type: Number },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const District = mongoose.model<IDistrict>('District', districtSchema, 'districts');
