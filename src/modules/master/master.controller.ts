import { Request, Response } from 'express';
import { OnboardingSlide } from '@/models/OnboardingSlide';
import { Category } from '@/models/Category';
import { District } from '@/models/District';
import { Faq } from '@/models/Faq';
import { Provider } from '@/models/Provider';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const masterController = {
  async getOnboardingSlides(req: Request, res: Response) {
    const role = req.appRole || 'user';
    const slides = await OnboardingSlide.find({
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

    return respond.ok(req, res, { slides: formatted });
  },

  async getCategories(req: Request, res: Response) {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();

    if (req.appRole === 'provider' || req.appRole === 'admin') {
      const items = categories.map((c) => ({
        id: c._id,
        title: c.name,
        icon: c.providerIcon,
      }));
      return respond.ok(req, res, items);
    }

    const items = categories.map((c) => ({
      id: c._id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    }));
    return respond.ok(req, res, items);
  },

  async getCategoryDetails(req: Request, res: Response) {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();

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

    return respond.ok(req, res, items);
  },

  async getDistricts(req: Request, res: Response) {
    const filterDistrict = req.query.district as string | undefined;
    const query: Record<string, unknown> = { isActive: true };

    if (filterDistrict) {
      query._id = filterDistrict.toLowerCase();
    }

    const districts = await District.find(query).sort({ isDefault: -1, name: 1 }).lean();

    if (req.appRole === 'provider' || req.appRole === 'admin') {
      const items = districts.map((d) => ({
        district: d.name,
        areas: d.areas.map((a) => a.name),
      }));
      return respond.ok(req, res, items);
    }

    const items = districts.map((d) => ({
      id: d._id,
      name: d.name,
      isDefault: d.isDefault,
      areas: d.areas.map((a) => a.name),
    }));
    return respond.ok(req, res, items);
  },

  async getEventTypes(req: Request, res: Response) {
    const categorySlug = (req.query.category as string)?.toLowerCase();
    if (!categorySlug) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'category query parameter is required');
    }

    const category = await Category.findById(categorySlug).lean();
    if (!category) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `Unknown category: ${categorySlug}`);
    }

    return respond.ok(req, res, {
      eventTypes: category.eventTypes || [],
      services: category.services || [],
    });
  },

  async getFaqs(req: Request, res: Response) {
    const role = req.appRole || 'user';
    const rolesAllowed = role === 'provider' ? ['provider', 'both'] : ['user', 'both'];

    const faqs = await Faq.find({
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

    return respond.ok(req, res, items);
  },

  async getFiltersMeta(req: Request, res: Response) {
    const category = req.query.category as string | undefined;

    const matchQuery: Record<string, unknown> = {
      status: 'approved',
      isActive: true,
    };
    if (category) {
      matchQuery.category = category;
    }

    const providers = await Provider.find(matchQuery).select('pricing').lean();
    let min = 100;
    let max = 50000;

    if (providers.length > 0) {
      const prices = providers
        .map((p) => p.pricing?.startingPrice)
        .filter((price): price is number => typeof price === 'number' && price > 0);

      if (prices.length > 0) {
        min = Math.min(...prices);
        max = Math.max(...prices);
      }
    }

    return respond.ok(req, res, {
      priceRange: { min, max },
      dietary: ['veg', 'non_veg', 'both'],
      sortOptions: ['relevance', 'rating', 'distance', 'price'],
      ratingOptions: [4.5, 4, 3.5, 3],
    });
  },
};
