"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packagesController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const MenuPackage_1 = require("@/models/MenuPackage");
const Dish_1 = require("@/models/Dish");
const Provider_1 = require("@/models/Provider");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
async function assertCateringProvider(providerId) {
    const provider = await Provider_1.Provider.findById(providerId).lean();
    if (!provider) {
        throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
    }
    const isCatering = provider.category === 'catering' ||
        (provider.secondaryCategories || []).includes('catering');
    if (!isCatering) {
        throw new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.FORBIDDEN, 'Packages are available for catering providers');
    }
}
exports.packagesController = {
    async getPackages(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const packages = await MenuPackage_1.MenuPackage.find({ providerId }).sort({ createdAt: -1 }).lean();
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
        return respond_1.respond.ok(req, res, items);
    },
    async createPackage(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const { name, pricePerPlate, description, minGuests, dishIds } = req.body;
        if (!name || name.trim().length < 2) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'name is required');
        }
        if (typeof pricePerPlate !== 'number' || pricePerPlate <= 0) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'price_per_plate must be greater than 0');
        }
        if (!Array.isArray(dishIds) || dishIds.length === 0) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'At least one dish_id is required');
        }
        // Verify all dishes belong to the provider
        const dishes = await Dish_1.Dish.find({
            _id: { $in: dishIds },
            providerId,
        }).lean();
        if (dishes.length !== dishIds.length) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'One or more dish IDs are invalid or belong to another provider');
        }
        const isVeg = dishes.every((d) => d.isVeg);
        const pkg = await MenuPackage_1.MenuPackage.create({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            name: name.trim(),
            pricePerPlate,
            description,
            minGuests: minGuests || 1,
            dishIds: dishIds.map((id) => new mongoose_1.default.Types.ObjectId(id)),
            isVeg,
            isActive: true,
        });
        return respond_1.respond.created(req, res, { id: pkg._id.toString() });
    },
    async getPackageById(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const { id } = req.params;
        const pkg = await MenuPackage_1.MenuPackage.findOne({ _id: id, providerId }).lean();
        if (!pkg) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Package not found');
        }
        return respond_1.respond.ok(req, res, {
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
    async updatePackage(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const { id } = req.params;
        const { name, pricePerPlate, description, minGuests, dishIds } = req.body;
        const pkg = await MenuPackage_1.MenuPackage.findOne({ _id: id, providerId });
        if (!pkg) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Package not found');
        }
        if (name)
            pkg.name = name.trim();
        if (typeof pricePerPlate === 'number' && pricePerPlate > 0)
            pkg.pricePerPlate = pricePerPlate;
        if (description !== undefined)
            pkg.description = description;
        if (typeof minGuests === 'number')
            pkg.minGuests = minGuests;
        if (Array.isArray(dishIds)) {
            const dishes = await Dish_1.Dish.find({ _id: { $in: dishIds }, providerId }).lean();
            if (dishes.length !== dishIds.length) {
                throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Invalid dishes list');
            }
            pkg.dishIds = dishIds.map((d) => new mongoose_1.default.Types.ObjectId(d));
            pkg.isVeg = dishes.every((d) => d.isVeg);
        }
        await pkg.save();
        return respond_1.respond.ok(req, res, { saved: true });
    },
    async patchPackageStatus(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'is_active must be a boolean');
        }
        const pkg = await MenuPackage_1.MenuPackage.findOneAndUpdate({ _id: id, providerId }, { isActive }, { new: true });
        if (!pkg) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Package not found');
        }
        return respond_1.respond.ok(req, res, { isActive: pkg.isActive });
    },
    async deletePackage(req, res) {
        const providerId = req.auth.sub;
        await assertCateringProvider(providerId);
        const { id } = req.params;
        const pkg = await MenuPackage_1.MenuPackage.findOneAndDelete({ _id: id, providerId });
        if (!pkg) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Package not found');
        }
        return respond_1.respond.message(req, res, 'Package removed');
    },
};
