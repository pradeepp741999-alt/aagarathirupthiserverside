import { z } from 'zod';
import { CATEGORIES, PRICING_MODELS, VEG_PREFERENCES } from '@/config/constants';

export const step1Schema = z.object({
  businessName: z.string().trim().min(2).max(150),
  ownerName: z.string().trim().min(2).max(120),
  whatsapp: z
    .string()
    .transform((val) => val.replace(/\D/g, '').slice(-10))
    .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' }),
  email: z.string().trim().email().optional().or(z.literal('')),
  district: z.string().trim().min(1),
  description: z.string().max(1000).optional(),
  tagline: z.string().max(255).optional(),
});

export const step2Schema = z.object({
  primaryCategory: z.enum(CATEGORIES),
  secondaryCategories: z.array(z.enum(CATEGORIES)).default([]),
});

export const step3Schema = z.object({
  category: z.enum(CATEGORIES).optional(),
  vegPreference: z.enum(VEG_PREFERENCES).optional(),
  minCapacity: z.number().min(1).optional(),
  maxCapacity: z.number().min(1).optional(),
  yearsActive: z.number().min(0).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  makeupSpecialties: z.array(z.string()).optional(),
  bridalTrialOffered: z.boolean().optional(),
  serviceLocation: z.enum(['venue', 'home', 'venue_and_home']).optional(),
  maxDailyClients: z.number().min(1).optional(),
});

export const step4Schema = z.object({
  pricingModel: z.enum(PRICING_MODELS),
  startingPrice: z.number().min(1, 'starting_price must be greater than 0'),
  advancePercentage: z.number().min(0).max(100).default(30),
  cancellationPolicy: z.string().max(500).optional(),
  paymentTerms: z.string().max(500).optional(),
});

export const step5Schema = z.object({
  districts: z.array(z.string()).min(1, 'At least one coverage district is required'),
  serviceAreas: z.array(z.string()).default([]),
  travelsOutstation: z.boolean().default(false),
  outstationFeePerKm: z.number().min(0).default(0),
});

export const step6Schema = z.object({
  documents: z.array(
    z.object({
      type: z.enum(['aadhaar', 'pan', 'gst', 'trade_license', 'fssai']),
      number: z.string().optional(),
      expiryDate: z.string().optional(),
      fileUrl: z.string().url(),
    })
  ),
});

export const submitRegistrationSchema = z.object({
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms to submit your application',
  }),
  submittedAt: z.string().optional(),
});
