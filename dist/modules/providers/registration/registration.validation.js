"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitRegistrationSchema = exports.step6Schema = exports.step5Schema = exports.step4Schema = exports.step3Schema = exports.step2Schema = exports.step1Schema = void 0;
const zod_1 = require("zod");
const constants_1 = require("@/config/constants");
exports.step1Schema = zod_1.z.object({
    businessName: zod_1.z.string().trim().min(2).max(150),
    ownerName: zod_1.z.string().trim().min(2).max(120),
    whatsapp: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' }),
    email: zod_1.z.string().trim().email().optional().or(zod_1.z.literal('')),
    district: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().max(1000).optional(),
    tagline: zod_1.z.string().max(255).optional(),
});
exports.step2Schema = zod_1.z.object({
    primaryCategory: zod_1.z.enum(constants_1.CATEGORIES),
    secondaryCategories: zod_1.z.array(zod_1.z.enum(constants_1.CATEGORIES)).default([]),
});
exports.step3Schema = zod_1.z.object({
    category: zod_1.z.enum(constants_1.CATEGORIES).optional(),
    vegPreference: zod_1.z.enum(constants_1.VEG_PREFERENCES).optional(),
    minCapacity: zod_1.z.number().min(1).optional(),
    maxCapacity: zod_1.z.number().min(1).optional(),
    yearsActive: zod_1.z.number().min(0).optional(),
    cuisineTypes: zod_1.z.array(zod_1.z.string()).optional(),
    specialties: zod_1.z.array(zod_1.z.string()).optional(),
    makeupSpecialties: zod_1.z.array(zod_1.z.string()).optional(),
    bridalTrialOffered: zod_1.z.boolean().optional(),
    serviceLocation: zod_1.z.enum(['venue', 'home', 'venue_and_home']).optional(),
    maxDailyClients: zod_1.z.number().min(1).optional(),
});
exports.step4Schema = zod_1.z.object({
    pricingModel: zod_1.z.enum(constants_1.PRICING_MODELS),
    startingPrice: zod_1.z.number().min(1, 'starting_price must be greater than 0'),
    advancePercentage: zod_1.z.number().min(0).max(100).default(30),
    cancellationPolicy: zod_1.z.string().max(500).optional(),
    paymentTerms: zod_1.z.string().max(500).optional(),
});
exports.step5Schema = zod_1.z.object({
    districts: zod_1.z.array(zod_1.z.string()).min(1, 'At least one coverage district is required'),
    serviceAreas: zod_1.z.array(zod_1.z.string()).default([]),
    travelsOutstation: zod_1.z.boolean().default(false),
    outstationFeePerKm: zod_1.z.number().min(0).default(0),
});
exports.step6Schema = zod_1.z.object({
    documents: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['aadhaar', 'pan', 'gst', 'trade_license', 'fssai']),
        number: zod_1.z.string().optional(),
        expiryDate: zod_1.z.string().optional(),
        fileUrl: zod_1.z.string().url(),
    })),
});
exports.submitRegistrationSchema = zod_1.z.object({
    termsAccepted: zod_1.z.boolean().refine((val) => val === true, {
        message: 'You must accept the terms to submit your application',
    }),
    submittedAt: zod_1.z.string().optional(),
});
