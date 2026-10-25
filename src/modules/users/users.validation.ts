import { z } from 'zod';

export const userProfileCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  district: z.string().trim().min(1, 'District is required'),
  location: z.string().trim().min(1, 'Location (area) is required'),
  whatsapp: z
    .string()
    .transform((val) => val.replace(/\D/g, '').slice(-10))
    .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' })
    .optional(),
});

export const userProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  whatsapp: z
    .string()
    .transform((val) => val.replace(/\D/g, '').slice(-10))
    .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid whatsapp number' }),
  altMobile: z
    .string()
    .transform((val) => val.replace(/\D/g, '').slice(-10))
    .refine((val) => /^[6-9]\d{9}$/.test(val), { message: 'Invalid alternate mobile number' })
    .optional()
    .nullable(),
  district: z.string().trim().min(1),
  location: z.string().trim().min(1),
});

export const userLocationPatchSchema = z
  .object({
    district: z.string().trim().optional(),
    location: z.string().trim().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine(
    (data) =>
      data.district !== undefined ||
      data.location !== undefined ||
      data.lat !== undefined ||
      data.lng !== undefined,
    {
      message: 'At least one location field (district, location, lat, lng) is required',
    }
  );
