import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MenuPackage } from '@/models/MenuPackage';
import { Dish } from '@/models/Dish';
import { Provider } from '@/models/Provider';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

async function assertCateringProvider(providerId: string) {
  const provider = await Provider.findById(providerId).lean();
  if (!provider) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
  }
  const isCatering =
    provider.category === 'catering' ||
    (provider.secondaryCategories || []).includes('catering');
  if (!isCatering) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Packages are available for catering providers');
  }
}

export const packagesController = {
  async getPackages(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);

    const packages = await MenuPackage.find({ providerId }).sort({ createdAt: -1 }).lean();

    const items = packages.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      price: p.pricePerPlate,
      pricePerPlate: p.pricePerPlate,
      isActive: p.isActive,
      itemsCount: p.dishIds ? p.dishIds.length : 0,
      minGuests: p.minGuests,
      isVeg: p.isVeg,
    }));

    return respond.ok(req, res, items);
  },

  async createPackage(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);

    const { name, pricePerPlate, description, minGuests, dishIds } = req.body;

    if (!name || name.trim().length < 2) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'name is required');
    }
    if (typeof pricePerPlate !== 'number' || pricePerPlate <= 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'price_per_plate must be greater than 0');
    }
    if (!Array.isArray(dishIds) || dishIds.length === 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'At least one dish_id is required');
    }

    // Verify all dishes belong to the provider
    const dishes = await Dish.find({
      _id: { $in: dishIds },
      providerId,
    }).lean();

    if (dishes.length !== dishIds.length) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'One or more dish IDs are invalid or belong to another provider');
    }

    const isVeg = dishes.every((d) => d.isVeg);

    const pkg = await MenuPackage.create({
      providerId: new mongoose.Types.ObjectId(providerId),
      name: name.trim(),
      pricePerPlate,
      description,
      minGuests: minGuests || 1,
      dishIds: dishIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      isVeg,
      isActive: true,
    });

    return respond.created(req, res, { id: pkg._id.toString() });
  },

  async getPackageById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;

    const pkg = await MenuPackage.findOne({ _id: id, providerId }).lean();
    if (!pkg) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Package not found');
    }

    return respond.ok(req, res, {
      id: pkg._id.toString(),
      name: pkg.name,
      pricePerPlate: pkg.pricePerPlate,
      description: pkg.description || '',
      minGuests: pkg.minGuests,
      dishIds: pkg.dishIds.map((d) => d.toString()),
      isVeg: pkg.isVeg,
      isActive: pkg.isActive,
    });
  },

  async updatePackage(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;
    const { name, pricePerPlate, description, minGuests, dishIds } = req.body;

    const pkg = await MenuPackage.findOne({ _id: id, providerId });
    if (!pkg) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Package not found');
    }

    if (name) pkg.name = name.trim();
    if (typeof pricePerPlate === 'number' && pricePerPlate > 0) pkg.pricePerPlate = pricePerPlate;
    if (description !== undefined) pkg.description = description;
    if (typeof minGuests === 'number') pkg.minGuests = minGuests;

    if (Array.isArray(dishIds)) {
      const dishes = await Dish.find({ _id: { $in: dishIds }, providerId }).lean();
      if (dishes.length !== dishIds.length) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Invalid dishes list');
      }
      pkg.dishIds = dishIds.map((d: string) => new mongoose.Types.ObjectId(d));
      pkg.isVeg = dishes.every((d) => d.isVeg);
    }

    await pkg.save();

    return respond.ok(req, res, { saved: true });
  },

  async patchPackageStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'is_active must be a boolean');
    }

    const pkg = await MenuPackage.findOneAndUpdate(
      { _id: id, providerId },
      { isActive },
      { new: true }
    );
    if (!pkg) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Package not found');
    }

    return respond.ok(req, res, { isActive: pkg.isActive });
  },

  async deletePackage(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;

    const pkg = await MenuPackage.findOneAndDelete({ _id: id, providerId });
    if (!pkg) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Package not found');
    }

    return respond.message(req, res, 'Package removed');
  },
};
