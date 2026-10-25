import mongoose, { Schema, Document } from 'mongoose';
import { APP_ROLES, AppRole } from '@/config/constants';

export interface ISupportTicketReply {
  by: 'admin' | 'requester';
  message: string;
  at: Date;
}

export interface ISupportTicket extends Document {
  code: string;
  role: AppRole;
  subjectId: mongoose.Types.ObjectId;
  source: 'ticket' | 'support_enquiry';
  subject: string;
  category: 'billing' | 'technical' | 'account' | 'general';
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  replies: ISupportTicketReply[];
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: APP_ROLES,
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['ticket', 'support_enquiry'],
      default: 'ticket',
    },
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ['billing', 'technical', 'account', 'general'],
      default: 'general',
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    replies: [
      {
        by: { type: String, enum: ['admin', 'requester'], required: true },
        message: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const SupportTicket = mongoose.model<ISupportTicket>(
  'SupportTicket',
  supportTicketSchema,
  'support_tickets'
);
