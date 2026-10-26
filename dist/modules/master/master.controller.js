"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.masterController = void 0;
const OnboardingSlide_1 = require("@/models/OnboardingSlide");
const Category_1 = require("@/models/Category");
const District_1 = require("@/models/District");
const Faq_1 = require("@/models/Faq");
const Provider_1 = require("@/models/Provider");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.masterController = {
    async getOnboardingSlides(req, res) {
        const role = req.appRole || 'user';
        const slides = await OnboardingSlide_1.OnboardingSlide.find({
            role: role === 'admin' ? 'user' : role,
            isActive: true,
        })
            .sort({ order: 1 })
            .lean();
        const formatted = slides.map((s) => ({
            id: s._id.toString(),
            title: s.title,
            subtitle: s.subtitle,
            image: s.image,
        }));
        return respond_1.respond.ok(req, res, { slides: formatted });
    },
    async getCategories(req, res) {
        const categories = await Category_1.Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
        if (req.appRole === 'provider' || req.appRole === 'admin') {
            const items = categories.map((c) => ({
                id: c._id,
                title: c.name,
                icon: c.providerIcon,
            }));
            return respond_1.respond.ok(req, res, items);
        }
        const items = categories.map((c) => ({
            id: c._id,
            name: c.name,
            icon: c.icon,
            color: c.color,
        }));
        return respond_1.respond.ok(req, res, items);
    },
    async getCategoryDetails(req, res) {
        const categories = await Category_1.Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
        const items = categories.map((c) => ({
            id: c._id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            description: c.description,
            startingPrice: c.startingPriceHint,
            highlights: c.highlights,
            serviceScope: c.serviceScope,
            isActive: c.isActive,
        }));
        return respond_1.respond.ok(req, res, items);
    },
    async getDistricts(req, res) {
        const filterDistrict = req.query.district;
        const query = { isActive: true };
        if (filterDistrict) {
            query._id = filterDistrict.toLowerCase();
        }
        const districts = await District_1.District.find(query).sort({ isDefault: -1, name: 1 }).lean();
        if (req.appRole === 'provider' || req.appRole === 'admin') {
            const items = districts.map((d) => ({
                district: d.name,
                areas: d.areas.map((a) => a.name),
            }));
            return respond_1.respond.ok(req, res, items);
        }
        const items = districts.map((d) => ({
            id: d._id,
            name: d.name,
            isDefault: d.isDefault,
            areas: d.areas.map((a) => a.name),
        }));
        return respond_1.respond.ok(req, res, items);
    },
    async getEventTypes(req, res) {
        const categorySlug = req.query.category?.toLowerCase();
        if (!categorySlug) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'category query parameter is required');
        }
        const category = await Category_1.Category.findById(categorySlug).lean();
        if (!category) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, `Unknown category: ${categorySlug}`);
        }
        return respond_1.respond.ok(req, res, {
            eventTypes: category.eventTypes || [],
            services: category.services || [],
        });
    },
    async getFaqs(req, res) {
        const role = req.appRole || 'user';
        const rolesAllowed = role === 'provider' ? ['provider', 'both'] : ['user', 'both'];
        const faqs = await Faq_1.Faq.find({
            role: { $in: rolesAllowed },
            isActive: true,
        })
            .sort({ order: 1 })
            .lean();
        const items = faqs.map((f) => ({
            id: f._id.toString(),
            question: f.question,
            answer: f.answer,
        }));
        return respond_1.respond.ok(req, res, items);
    },
    async getFiltersMeta(req, res) {
        const category = req.query.category;
        const matchQuery = {
            status: 'approved',
            isActive: true,
        };
        if (category) {
            matchQuery.category = category;
        }
        const providers = await Provider_1.Provider.find(matchQuery).select('pricing').lean();
        let min = 100;
        let max = 50000;
        if (providers.length > 0) {
            const prices = providers
                .map((p) => p.pricing?.startingPrice)
                .filter((price) => typeof price === 'number' && price > 0);
            if (prices.length > 0) {
                min = Math.min(...prices);
                max = Math.max(...prices);
            }
        }
        return respond_1.respond.ok(req, res, {
            priceRange: { min, max },
            dietary: ['veg', 'non_veg', 'both'],
            sortOptions: ['relevance', 'rating', 'distance', 'price'],
            ratingOptions: [4.5, 4, 3.5, 3],
        });
    },
};
