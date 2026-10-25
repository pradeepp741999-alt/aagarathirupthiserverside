import { Request, Response } from 'express';
import dayjs from 'dayjs';
import { Provider } from '@/models/Provider';
import { ProviderDocument } from '@/models/ProviderDocument';
import { storage } from '@/services/storage';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';
import { REQUIRED_DOC_TYPES } from '@/config/constants';

function computeProfileCompletion(provider: any, docCount: number): number {
  let percent = 0;
  if (provider.businessName && provider.ownerName && provider.district) percent += 20;
  if (provider.category) percent += 10;
  if (provider.yearsActive !== undefined || provider.vegPreference) percent += 15;
  if (provider.pricing?.startingPrice > 0) percent += 15;
  if (provider.coverage?.districts?.length > 0) percent += 10;
  if (docCount >= REQUIRED_DOC_TYPES.length) percent += 15;
  if (provider.coverImage) percent += 10;
  if (provider.tagline) percent += 5;
  return Math.min(100, percent);
}

export const meController = {
  async getStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    let estimatedDecision: string | null = null;
    if (provider.submittedAt) {
      estimatedDecision = dayjs(provider.submittedAt).add(48, 'hour').toISOString();
    }

    return respond.ok(req, res, {
      status: provider.status,
      submissionDate: provider.submittedAt ? provider.submittedAt.toISOString() : null,
      rejectionReason: provider.rejectionReason || null,
      estimatedDecision,
    });
  },

  async getMe(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const docCount = await ProviderDocument.countDocuments({
      providerId: provider._id,
      type: { $in: REQUIRED_DOC_TYPES },
    });

    const completionPercent = computeProfileCompletion(provider, docCount);

    const profile = {
      id: provider._id.toString(),
      businessName: provider.businessName || null,
      ownerName: provider.ownerName || null,
      mobile: provider.mobile,
      whatsapp: provider.whatsapp || null,
      email: provider.email || null,
      tagline: provider.tagline || null,
      description: provider.description || null,
      category: provider.category || null,
      secondaryCategories: provider.secondaryCategories || [],
      rating: provider.rating || 0,
      reviewCount: provider.reviewCount || 0,
      isOnline: provider.isOnline !== false,
      verified: provider.verified || false,
      status: provider.status,
      coverImage: provider.coverImage || null,
      logoColor: provider.logoColor || '#0E7C7B',
      portfolioImages: (provider.portfolioImages || []).map((img) => img.url),
      district: provider.district || null,
      profileCompletionPercent: completionPercent,
    };

    return respond.ok(req, res, profile);
  },

  async updateMe(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const {
      businessName,
      ownerName,
      tagline,
      description,
      whatsapp,
      email,
      coverImage,
      logoColor,
      portfolioImages,
      lat,
      lng,
    } = req.body;

    if (coverImage) {
      await storage.assertOwned(coverImage, {
        ownerRole: 'provider',
        ownerId: provider._id.toString(),
      });
      provider.coverImage = coverImage;
    }

    if (Array.isArray(portfolioImages)) {
      if (portfolioImages.length > 12) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Maximum 12 portfolio images allowed');
      }
      for (const imgUrl of portfolioImages) {
        await storage.assertOwned(imgUrl, {
          ownerRole: 'provider',
          ownerId: provider._id.toString(),
        });
      }
      provider.portfolioImages = portfolioImages.map((url: string) => ({ url }));
    }

    if (businessName) provider.businessName = businessName;
    if (ownerName) provider.ownerName = ownerName;
    if (tagline !== undefined) provider.tagline = tagline;
    if (description !== undefined) provider.description = description;
    if (whatsapp) provider.whatsapp = whatsapp;
    if (email !== undefined) provider.email = email;
    if (logoColor) provider.logoColor = logoColor;

    if (typeof lat === 'number' && typeof lng === 'number') {
      provider.geo = { lat, lng };
    }

    await provider.save();

    return respond.ok(req, res, undefined, {
      message: 'Profile updated successfully',
    });
  },

  async patchOnlineStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'is_online must be a boolean');
    }

    const provider = await Provider.findByIdAndUpdate(
      providerId,
      { isOnline },
      { new: true }
    );

    return respond.ok(req, res, { isOnline: provider?.isOnline });
  },

  async getSettings(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const settings = {
      pricingModel: provider.pricing?.model || 'per_plate',
      startingPrice: provider.pricing?.startingPrice || 0,
      minCapacity: provider.minCapacity || 1,
      maxCapacity: provider.maxCapacity || 1000,
      advanceNoticeDays: provider.settings?.advanceNoticeDays ?? 3,
      autoAcceptEnquiries: provider.settings?.autoAcceptEnquiries ?? false,
      cancellationPolicy: provider.pricing?.cancellationPolicy || '',
      advancePercentage: provider.pricing?.advancePercentage || 30,
      paymentTerms: provider.pricing?.paymentTerms || '',
    };

    return respond.ok(req, res, settings);
  },

  async updateSettings(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const {
      pricingModel,
      startingPrice,
      minCapacity,
      maxCapacity,
      advanceNoticeDays,
      autoAcceptEnquiries,
      cancellationPolicy,
      advancePercentage,
      paymentTerms,
    } = req.body;

    if (startingPrice !== undefined && startingPrice <= 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'starting_price must be greater than 0');
    }

    if (advancePercentage !== undefined && (advancePercentage < 0 || advancePercentage > 100)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'advance_percentage must be between 0 and 100');
    }

    if (advanceNoticeDays !== undefined && (advanceNoticeDays < 0 || advanceNoticeDays > 60)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'advance_notice_days must be between 0 and 60');
    }

    if (pricingModel) provider.pricing.model = pricingModel;
    if (startingPrice !== undefined) provider.pricing.startingPrice = startingPrice;
    if (advancePercentage !== undefined) provider.pricing.advancePercentage = advancePercentage;
    if (cancellationPolicy !== undefined) provider.pricing.cancellationPolicy = cancellationPolicy;
    if (paymentTerms !== undefined) provider.pricing.paymentTerms = paymentTerms;

    if (minCapacity !== undefined) provider.minCapacity = minCapacity;
    if (maxCapacity !== undefined) provider.maxCapacity = maxCapacity;

    if (provider.minCapacity && provider.maxCapacity && provider.minCapacity > provider.maxCapacity) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'min_capacity cannot exceed max_capacity');
    }

    if (advanceNoticeDays !== undefined) {
      provider.settings.advanceNoticeDays = advanceNoticeDays;
    }
    if (autoAcceptEnquiries !== undefined) {
      provider.settings.autoAcceptEnquiries = autoAcceptEnquiries;
    }

    await provider.save();

    return respond.ok(req, res, undefined, {
      message: 'Settings updated',
    });
  },
};
