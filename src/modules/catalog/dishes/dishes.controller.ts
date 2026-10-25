import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Dish } from '@/models/Dish';
import { MenuPackage } from '@/models/MenuPackage';
import { Provider } from '@/models/Provider';
import { storage } from '@/services/storage';
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
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Dishes are available for catering providers');
  }
}

export const dishesController = {
  async getDishes(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);

    const { category, active, search } = req.query;
    const query: Record<string, unknown> = {
      providerId: new mongoose.Types.ObjectId(providerId),
    };

    if (category) {
      query.category = (category as string).toLowerCase();
    }
    if (active !== undefined) {
      query.isActive = String(active) === 'true';
    }
    if (search) {
      query.name = { $regex: new RegExp(search as string, 'i') };
    }

    const dishes = await Dish.find(query).sort({ category: 1, name: 1 }).lean();

    const items = dishes.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      category: d.category,
      price: d.price,
      isVeg: d.isVeg,
      isPopular: d.isPopular,
      isActive: d.isActive,
      photoUrl: d.photoUrl || null,
      description: d.description || null,
    }));

    return respond.ok(req, res, items);
  },

  async createDish(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);

    const { name, category, price, isVeg, isPopular, photoUrl, description } = req.body;

    if (!name || name.trim().length < 2) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'name must be at least 2 characters');
    }
    if (!category) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'category is required');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'price must be a positive number');
    }
    if (typeof isVeg !== 'boolean') {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'is_veg must be a boolean');
    }

    if (photoUrl) {
      await storage.assertOwned(photoUrl, {
        ownerRole: 'provider',
        ownerId: providerId,
      });
    }

    const dish = await Dish.create({
      providerId: new mongoose.Types.ObjectId(providerId),
      name: name.trim(),
      category: category.trim().toLowerCase(),
      price,
      isVeg,
      isPopular: !!isPopular,
      photoUrl,
      description,
      isActive: true,
    });

    return respond.created(req, res, { id: dish._id.toString() });
  },

  async getDishById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;

    const dish = await Dish.findOne({
      _id: id,
      providerId,
    }).lean();

    if (!dish) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Dish not found');
    }

    return respond.ok(req, res, {
      id: dish._id.toString(),
      name: dish.name,
      category: dish.category,
      price: dish.price,
      isVeg: dish.isVeg,
      isPopular: dish.isPopular,
      isActive: dish.isActive,
      photoUrl: dish.photoUrl || null,
      description: dish.description || null,
    });
  },

  async updateDish(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;
    const { name, category, price, isVeg, isPopular, photoUrl, description } = req.body;

    const dish = await Dish.findOne({ _id: id, providerId });
    if (!dish) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Dish not found');
    }

    if (photoUrl && photoUrl !== dish.photoUrl) {
      await storage.assertOwned(photoUrl, {
        ownerRole: 'provider',
        ownerId: providerId,
      });
      dish.photoUrl = photoUrl;
    }

    if (name) dish.name = name.trim();
    if (category) dish.category = category.trim().toLowerCase();
    if (typeof price === 'number') dish.price = price;
    if (typeof isVeg === 'boolean') dish.isVeg = isVeg;
    if (typeof isPopular === 'boolean') dish.isPopular = isPopular;
    if (description !== undefined) dish.description = description;

    await dish.save();

    return respond.ok(req, res, { id: dish._id.toString(), saved: true });
  },

  async patchDishStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'is_active must be a boolean');
    }

    const dish = await Dish.findOneAndUpdate(
      { _id: id, providerId },
      { isActive },
      { new: true }
    );

    if (!dish) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Dish not found');
    }

    return respond.ok(req, res, { id: dish._id.toString(), isActive: dish.isActive });
  },

  async deleteDish(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    await assertCateringProvider(providerId);
    const { id } = req.params;

    const dish = await Dish.findOneAndDelete({ _id: id, providerId });
    if (!dish) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Dish not found');
    }

    // Pull from MenuPackages and recompute their isVeg
    const packages = await MenuPackage.find({
      providerId,
      dishIds: dish._id,
    });

    for (const pkg of packages) {
      pkg.dishIds = pkg.dishIds.filter((dId) => !dId.equals(dish._id as any));
      const remainingDishes = await Dish.find({ _id: { $in: pkg.dishIds } }).select('isVeg').lean();
      pkg.isVeg = remainingDishes.every((d) => d.isVeg);
      await pkg.save();
    }

    return respond.message(req, res, 'Dish deleted successfully');
  },
};
