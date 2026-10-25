import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { SpecialCombo } from '@/models/SpecialCombo';
import { Provider } from '@/models/Provider';
import { storage } from '@/services/storage';
import { parseTolerantDate, formatDisplayDate, ymd } from '@/common/utils/dates';
import { MAX_ACTIVE_COMBOS_PER_PROVIDER } from '@/config/constants';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const combosController = {
  // Provider GET /providers/combos
  async getProviderCombos(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { active, limit } = req.query;

    const query: Record<string, unknown> = { providerId };
    if (active !== undefined) {
      query.isActive = String(active) === 'true';
    }

    let q = SpecialCombo.find(query).sort({ createdAt: -1 });
    if (limit) {
      q = q.limit(parseInt(limit as string, 10));
    }

    const combos = await q.lean();

    const items = combos.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description || null,
      price: c.price,
      originalPrice: c.originalPrice || null,
      includedItems: c.includedItems || [],
      isActive: c.isActive,
      imageUrl: c.imageUrl,
      validUntil: ymd(c.validUntil),
      badge: c.badge || null,
    }));

    return respond.ok(req, res, items);
  },

  // Provider POST /providers/combos & alias POST /combos/special
  async createCombo(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    // Check active combo limit
    const activeCount = await SpecialCombo.countDocuments({
      providerId: provider._id,
      isActive: true,
    });

    if (activeCount >= MAX_ACTIVE_COMBOS_PER_PROVIDER) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        `Maximum ${MAX_ACTIVE_COMBOS_PER_PROVIDER} active combos allowed`
      );
    }

    const {
      name,
      description,
      price,
      originalPrice,
      includedItems,
      imageUrl,
      image,
      validUntil,
      badge,
      category,
    } = req.body;

    const finalImage = imageUrl || image;

    if (!name || name.trim().length < 3) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'name must be at least 3 characters');
    }
    if (typeof price !== 'number' || price <= 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'price must be greater than 0');
    }
    if (originalPrice !== undefined && (typeof originalPrice !== 'number' || originalPrice <= price)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'original_price must be greater than price');
    }
    if (!Array.isArray(includedItems) || includedItems.length === 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'included_items must contain at least 1 item');
    }
    if (!finalImage) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'image_url is required');
    }

    await storage.assertOwned(finalImage, {
      ownerRole: 'provider',
      ownerId: provider._id.toString(),
    });

    const parsedDate = parseTolerantDate(validUntil);
    if (!parsedDate || parsedDate < new Date()) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'valid_until must be a valid future date');
    }

    const diffDays = dayjs(parsedDate).diff(dayjs(), 'day');
    if (diffDays > 365) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'valid_until cannot be more than 1 year in the future');
    }

    const finalCategory = category || provider.category;

    const combo = await SpecialCombo.create({
      providerId: provider._id,
      category: finalCategory,
      name: name.trim(),
      description,
      includedItems,
      price,
      originalPrice,
      imageUrl: finalImage,
      validUntil: parsedDate,
      badge,
      isActive: true,
    });

    // If caller was user app via POST /combos/special alias (D20)
    if (req.originalUrl.includes('/combos/special')) {
      let finalBadge = combo.badge;
      if (!finalBadge && combo.originalPrice && combo.originalPrice > combo.price) {
        const discount = Math.round(((combo.originalPrice - combo.price) / combo.originalPrice) * 100);
        finalBadge = `${discount}% OFF`;
      }

      return res.status(201).json({
        id: combo._id.toString(),
        providerId: provider._id.toString(),
        providerName: provider.businessName || 'Provider',
        name: combo.name,
        description: combo.description || '',
        includedItems: combo.includedItems,
        price: combo.price,
        originalPrice: combo.originalPrice || null,
        image: combo.imageUrl,
        validUntil: `Valid till ${formatDisplayDate(combo.validUntil)}`,
        badge: finalBadge || null,
      });
    }

    return respond.created(req, res, { id: combo._id.toString() });
  },

  async getComboById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const combo = await SpecialCombo.findOne({ _id: id, providerId }).lean();
    if (!combo) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Combo not found');
    }

    return respond.ok(req, res, {
      id: combo._id.toString(),
      name: combo.name,
      description: combo.description || '',
      price: combo.price,
      originalPrice: combo.originalPrice || null,
      includedItems: combo.includedItems,
      imageUrl: combo.imageUrl,
      validUntil: ymd(combo.validUntil),
      badge: combo.badge || null,
      isActive: combo.isActive,
    });
  },

  async updateCombo(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { name, description, price, originalPrice, includedItems, imageUrl, validUntil, badge } = req.body;

    const combo = await SpecialCombo.findOne({ _id: id, providerId });
    if (!combo) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Combo not found');
    }

    if (imageUrl && imageUrl !== combo.imageUrl) {
      await storage.assertOwned(imageUrl, {
        ownerRole: 'provider',
        ownerId: providerId,
      });
      combo.imageUrl = imageUrl;
    }

    if (name) combo.name = name.trim();
    if (description !== undefined) combo.description = description;
    if (typeof price === 'number') combo.price = price;
    if (originalPrice !== undefined) combo.originalPrice = originalPrice;
    if (Array.isArray(includedItems)) combo.includedItems = includedItems;
    if (badge !== undefined) combo.badge = badge;

    if (validUntil) {
      const parsed = parseTolerantDate(validUntil);
      if (!parsed || parsed < new Date()) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'valid_until must be a valid future date');
      }
      combo.validUntil = parsed;
    }

    await combo.save();

    return respond.ok(req, res, { saved: true });
  },

  async patchComboStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'is_active must be a boolean');
    }

    const combo = await SpecialCombo.findOneAndUpdate(
      { _id: id, providerId },
      { isActive },
      { new: true }
    );
    if (!combo) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Combo not found');
    }

    return respond.ok(req, res, { isActive: combo.isActive });
  },

  async deleteCombo(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const combo = await SpecialCombo.findOneAndDelete({ _id: id, providerId });
    if (!combo) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Combo not found');
    }

    return respond.message(req, res, 'Combo deleted');
  },

  // Public GET /combos/special
  async getPublicSpecialCombos(req: Request, res: Response) {
    const { category, district, limit } = req.query;
    const now = new Date();

    const providerMatch: Record<string, unknown> = {
      status: 'approved',
      isActive: true,
      isOnline: true,
    };
    if (district) {
      providerMatch.$or = [
        { 'coverage.isAllDistricts': true },
        { 'coverage.districts': { $in: [district, 'All', new RegExp(`^${district}$`, 'i')] } },
      ];
    }

    const approvedProviders = await Provider.find(providerMatch).select('businessName').lean();
    const approvedProviderIds = approvedProviders.map((p) => p._id);

    const comboQuery: Record<string, unknown> = {
      providerId: { $in: approvedProviderIds },
      isActive: true,
      validUntil: { $gte: now },
    };

    if (category) {
      comboQuery.category = (category as string).toLowerCase();
    }

    const maxItems = limit ? parseInt(limit as string, 10) : 10;

    const combos = await SpecialCombo.find(comboQuery)
      .sort({ createdAt: -1 })
      .limit(maxItems)
      .populate<{ providerId: { _id: mongoose.Types.ObjectId; businessName?: string } }>({
        path: 'providerId',
        select: 'businessName',
      })
      .lean();

    const items = combos.map((c) => {
      let finalBadge = c.badge;
      if (!finalBadge && c.originalPrice && c.originalPrice > c.price) {
        const discount = Math.round(((c.originalPrice - c.price) / c.originalPrice) * 100);
        finalBadge = `${discount}% OFF`;
      }

      return {
        id: c._id.toString(),
        providerId: c.providerId?._id?.toString() || '',
        providerName: c.providerId?.businessName || 'Service Provider',
        name: c.name,
        description: c.description || '',
        includedItems: c.includedItems || [],
        price: c.price,
        originalPrice: c.originalPrice || null,
        image: c.imageUrl,
        validUntil: `Valid till ${formatDisplayDate(c.validUntil)}`,
        badge: finalBadge || null,
      };
    });

    return respond.ok(req, res, items);
  },
};
