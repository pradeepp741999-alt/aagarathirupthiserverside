import mongoose, { Schema, Document } from 'mongoose';

export interface IRequirementDraft extends Document {
  userId: mongoose.Types.ObjectId;
  payload: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const requirementDraftSchema = new Schema<IRequirementDraft>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const RequirementDraft = mongoose.model<IRequirementDraft>(
  'RequirementDraft',
  requirementDraftSchema,
  'requirement_drafts'
);
