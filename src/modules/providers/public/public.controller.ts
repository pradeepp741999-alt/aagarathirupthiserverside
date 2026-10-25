import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Provider, IProvider } from '@/models/Provider';
import { Dish } from '@/models/Dish';
import { MenuPackage } from '@/models/MenuPackage';
import { Review } from '@/models/Review';
import { SpecialCombo } from '@/models/SpecialCombo';
import { District } from '@/models/District';
import { calendarService } from '@/services/calendar.service';
import { matchingService } from '@/services/matching.service';
import { ratingService } from '@/services/rating.service';
import { haversineKm, Coordinates } from '@/common/utils/distance';
import { DISH_CATEGORIES, CategorySlug } from '@/config/constants';
import { parsePagination } from '@/common/http/pagination';
import { formatDisplayDate, ymd } from '@/common/utils/dates';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

function toProviderSummary(p: any, distanceKm: number | null = null, isAvailable = true) {
  const categoriesList: CategorySlug[] = [p.category, ...(p.secondaryCategories || [])].filter(Boolean);

  const responseTime =
    (p.avgResponseMinutes || 120) <= 60
      ? 'Usually responds within 1 hour'
      : (p.avgResponseMinutes || 120) <= 120
        ? 'Usually responds within 2 hours'
        : 'Usually responds in a few hours';

  return {
    id: p._id.toString(),
    name: p.businessName || 'Service Provider',
    category: p.category,
    categories: categoriesList,
    tagline: p.tagline || '',
    rating: p.rating || 0,
    reviewCount: p.reviewCount || 0,
    startingPrice: p.pricing?.startingPrice || 0,
    pricingModel: p.pricing?.model || 'per_plate',
    verified: p.verified || false,
    isOnline: p.isOnline !== false,
    distanceKm,
    isAvailable,
    coverImage: p.coverImage || null,
    logoColor: p.logoColor || '#0E7C7B',
    district: p.district || '',
    areas: p.coverage?.areas || [],
    vegPreference: p.vegPreference || 'both',
    minCapacity: p.minCapacity || 1,
    maxCapacity: p.maxCapacity || 1000,
    responseTime,
  };
}

export const publicProvidersController = {
  // GET /providers
  async listProviders(req: Request, res: Response) {
    const { category, district, query, sort, minRating, veg, minPrice, maxPrice } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const mongoQuery: Record<string, unknown> = {
      status: 'approved',
      isActive: true,
    };

    if (category) {
      const catLower = (category as string).toLowerCase();
      mongoQuery.$or = [{ category: catLower }, { secondaryCategories: catLower }];
    }

    if (district) {
      const dName = district as string;
      mongoQuery.$and = [
        {
          $or: [
            { 'coverage.isAllDistricts': true },
            { 'coverage.districts': { $in: [dName, 'All', new RegExp(`^${dName}$`, 'i')] } },
          ],
        },
      ];
    }

    if (minRating) {
      mongoQuery.rating = { $gte: parseFloat(minRating as string) };
    }

    if (veg && veg !== 'both') {
      mongoQuery.vegPreference = { $in: [veg, 'both'] };
    }

    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter.$gte = parseFloat(minPrice as string);
      if (maxPrice) priceFilter.$lte = parseFloat(maxPrice as string);
      mongoQuery['pricing.startingPrice'] = priceFilter;
    }

    if (query) {
      const escaped = (query as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escaped, 'i');
      mongoQuery.$or = [
        { businessName: reg },
        { tagline: reg },
        { description: reg },
        { cuisineTypes: reg },
      ];
    }

    let sortObj: Record<string, 1 | -1> = { rating: -1, reviewCount: -1 };
    if (sort === 'price') {
      sortObj = { 'pricing.startingPrice': 1 };
    }

    const [providers, total] = await Promise.all([
      Provider.find(mongoQuery).sort(sortObj).skip(skip).limit(limit).lean(),
      Provider.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const items = providers.map((p) => toProviderSummary(p));

    return res.status(200).json({
      providers: items,
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    });
  },

  // GET /providers/nearby
  async getNearby(req: Request, res: Response) {
    const { lat, lng, district, area, category, limit } = req.query;
    const maxItems = limit ? parseInt(limit as string, 10) : 10;

    let origin: Coordinates | null = null;
    if (lat && lng) {
      origin = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    } else if (district) {
      const dist = await District.findOne({
        name: { $regex: new RegExp(`^${district}$`, 'i') },
      }).lean();
      if (dist) {
        if (area) {
          const matchedArea = dist.areas.find(
            (a) => a.name.toLowerCase() === (area as string).toLowerCase()
          );
          if (matchedArea?.lat && matchedArea?.lng) {
            origin = { lat: matchedArea.lat, lng: matchedArea.lng };
          }
        }
        if (!origin && dist.lat && dist.lng) {
          origin = { lat: dist.lat, lng: dist.lng };
        }
      }
    }

    const query: Record<string, unknown> = {
      status: 'approved',
      isActive: true,
      isOnline: true,
    };

    if (category) {
      const catLower = (category as string).toLowerCase();
      query.$or = [{ category: catLower }, { secondaryCategories: catLower }];
    }

    if (district) {
      const dName = district as string;
      query['coverage.districts'] = { $in: [dName, 'All', new RegExp(`^${dName}$`, 'i')] };
    }

    const providers = (await Provider.find(query).lean()) as unknown as IProvider[];

    const withDistance = providers.map((p) => {
      let distanceKm: number | null = null;
      if (origin && p.geo?.lat && p.geo?.lng) {
        distanceKm = haversineKm(origin, { lat: p.geo.lat, lng: p.geo.lng });
      }
      return { provider: p, distanceKm };
    });

    withDistance.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return (b.provider.rating || 0) - (a.provider.rating || 0);
    });

    const items = withDistance
      .slice(0, maxItems)
      .map(({ provider, distanceKm }) => toProviderSummary(provider, distanceKm));

    // Bare array per U-doc 5.4
    return res.status(200).json(items);
  },

  // POST /providers/match
  async match(req: Request, res: Response) {
    const payload = req.body.requirement || req.body;
    const result = await matchingService.matchProviders(payload);
    return res.status(200).json(result);
  },

  // GET /providers/:id
  async getProviderDetail(req: Request, res: Response) {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const provider = await Provider.findOne({
      _id: id,
      status: 'approved',
      isActive: true,
    }).lean();

    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const summary = toProviderSummary(provider);

    // Active combos
    const now = new Date();
    const combos = await SpecialCombo.find({
      providerId: provider._id,
      isActive: true,
      validUntil: { $gte: now },
    })
      .limit(3)
      .lean();

    const activeCombos = combos.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description || '',
      includedItems: c.includedItems,
      price: c.price,
      originalPrice: c.originalPrice || null,
      image: c.imageUrl,
      validUntil: `Valid till ${formatDisplayDate(c.validUntil)}`,
      badge: c.badge || null,
    }));

    let isAvailable = true;
    if (startDate) {
      const avail = await calendarService.checkRangeAvailability(
        id,
        startDate as string,
        (endDate as string) || (startDate as string)
      );
      isAvailable = avail.isAvailable;
    }

    const fullDetail = {
      ...summary,
      ownerName: provider.ownerName || null,
      about: provider.description || '',
      gallery: provider.coverImage ? [provider.coverImage] : [],
      previousWork: (provider.portfolioImages || []).map((img) => img.url),
      phone: provider.mobile,
      whatsapp: provider.whatsapp || provider.mobile,
      yearsActive: provider.yearsActive || 0,
      serviceAreas: {
        districts: provider.coverage?.districts || [],
        areas: provider.coverage?.areas || [],
        isAllDistricts: provider.coverage?.isAllDistricts || false,
        travelsOutstation: provider.coverage?.travelsOutstation || false,
        outstationFeePerKm: provider.coverage?.outstationFeePerKm || 0,
      },
      advancePercentage: provider.pricing?.advancePercentage || 30,
      cancellationPolicy: provider.pricing?.cancellationPolicy || '',
      paymentTerms: provider.pricing?.paymentTerms || '',
      advanceNoticeDays: provider.settings?.advanceNoticeDays ?? 3,
      specialties: provider.serviceDetails?.specialties || provider.cuisineTypes || [],
      cuisineTypes: provider.cuisineTypes || [],
      bridalTrialOffered: provider.serviceDetails?.bridalTrialOffered || false,
      serviceLocation: provider.serviceDetails?.serviceLocation || 'venue',
      isAvailable,
      activeCombos,
    };

    return res.status(200).json(fullDetail);
  },

  // GET /providers/:id/calendar
  async getCalendar(req: Request, res: Response) {
    const { id } = req.params;
    const year = parseInt(req.query.year as string, 10) || dayjs().year();
    const month = parseInt(req.query.month as string, 10) || dayjs().month() + 1;

    const data = await calendarService.getMonthCalendar(id, year, month);

    const datesMap: Record<string, string> = {};
    for (const item of data.dates) {
      datesMap[item.date] = item.status;
    }

    return res.status(200).json({
      providerId: id,
      dates: datesMap,
    });
  },

  // GET /providers/:id/availability
  async getAvailability(req: Request, res: Response) {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'startDate is required');
    }

    const start = startDate as string;
    const end = (endDate as string) || start;

    const result = await calendarService.checkRangeAvailability(id, start, end);
    return res.status(200).json(result);
  },

  // GET /providers/:id/reviews
  async getReviews(req: Request, res: Response) {
    const { id } = req.params;
    const { rating } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const query: Record<string, unknown> = {
      providerId: id,
      status: 'published',
    };
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating as string, 10);
    }

    const [reviews, total, summary] = await Promise.all([
      Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(query),
      ratingService.getReviewSummary(id),
    ]);

    const formattedReviews = reviews.map((r) => ({
      id: r._id.toString(),
      customerName: r.customerName,
      avatarColor: r.avatarColor || '#8B5CF6',
      rating: r.rating,
      ratings: r.ratings,
      eventType: r.eventType || '',
      comment: r.comment,
      photos: r.photos || [],
      createdAt: r.createdAt.toISOString(),
      providerReply: r.providerReply
        ? {
            text: r.providerReply.text,
            repliedAt: r.providerReply.repliedAt.toISOString(),
          }
        : null,
    }));

    return res.status(200).json({
      summary,
      reviews: formattedReviews,
      page,
      limit,
      total,
    });
  },

  // GET /providers/:id/menu
  async getMenu(req: Request, res: Response) {
    const { id } = req.params;
    const { veg } = req.query;

    const provider = await Provider.findById(id).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const isCatering =
      provider.category === 'catering' ||
      (provider.secondaryCategories || []).includes('catering');

    if (!isCatering) {
      return res.status(200).json([]);
    }

    const query: Record<string, unknown> = {
      providerId: id,
      isActive: true,
    };
    if (veg !== undefined) {
      query.isVeg = String(veg) === 'true';
    }

    const dishes = await Dish.find(query).lean();

    const categoryMap = new Map<string, any[]>();
    for (const d of dishes) {
      if (!categoryMap.has(d.category)) {
        categoryMap.set(d.category, []);
      }
      categoryMap.get(d.category)!.push({
        id: d._id.toString(),
        name: d.name,
        price: d.price,
        veg: d.isVeg,
        image: d.photoUrl || null,
        isPopular: d.isPopular,
        description: d.description || '',
      });
    }

    const slugToLabel = new Map<string, string>(
      DISH_CATEGORIES.map((c) => [c.slug, c.label])
    );

    const result = Array.from(categoryMap.entries()).map(([slug, items]) => {
      const title = slugToLabel.get(slug) || slug.charAt(0).toUpperCase() + slug.slice(1);
      return {
        category: title,
        dishes: items,
      };
    });

    return res.status(200).json(result);
  },

  // GET /providers/:id/packages
  async getPackages(req: Request, res: Response) {
    const { id } = req.params;

    const packages = await MenuPackage.find({
      providerId: id,
      isActive: true,
    })
      .populate<{ dishIds: Array<{ _id: mongoose.Types.ObjectId; name: string; isVeg: boolean }> }>({
        path: 'dishIds',
        select: 'name isVeg',
      })
      .lean();

    const items = packages.map((p) => {
      const dishes = (p.dishIds || []).map((d) => ({
        id: d._id.toString(),
        name: d.name,
        veg: d.isVeg,
      }));

      return {
        id: p._id.toString(),
        name: p.name,
        description: p.description || '',
        pricePerPerson: p.pricePerPlate,
        minGuests: p.minGuests,
        veg: p.isVeg,
        includedItems: dishes.map((d) => d.name),
        dishes,
      };
    });

    return res.status(200).json(items);
  },
};
