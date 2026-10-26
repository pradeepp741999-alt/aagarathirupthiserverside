"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userLocationPatchSchema = exports.userProfileUpdateSchema = exports.userProfileCreateSchema = void 0;
const zod_1 = require("zod");
exports.userProfileCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    district: zod_1.z.string().trim().min(1, 'District is required'),
    location: zod_1.z.string().trim().min(1, 'Location (area) is required'),
    whatsapp: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' })
        .optional(),
});
exports.userProfileUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100),
    whatsapp: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' }),
    altMobile: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid alternate mobile number' })
        .optional()
        .nullable(),
    district: zod_1.z.string().trim().min(1),
    location: zod_1.z.string().trim().min(1),
});
exports.userLocationPatchSchema = zod_1.z
    .object({
    district: zod_1.z.string().trim().optional(),
    location: zod_1.z.string().trim().optional(),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
})
    .refine((data) => data.district !== undefined ||
    data.location !== undefined ||
    data.lat !== undefined ||
    data.lng !== undefined, {
    message: 'At least one location field (district, location, lat, lng) is required',
});
