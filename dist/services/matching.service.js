"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const Provider_1 = require("@/models/Provider");
const ProviderAvailability_1 = require("@/models/ProviderAvailability");
const District_1 = require("@/models/District");
const distance_1 = require("@/common/utils/distance");
const dates_1 = require("@/common/utils/dates");
exports.matchingService = {
    async matchProviders(req) {
        const page = Math.max(1, req.page || 1);
        const limit = Math.min(100, Math.max(1, req.limit || 20));
        const sortBy = req.sortBy || 'relevance';
        // 1. Resolve origin coordinates for distance
        let origin = null;
        if (typeof req.lat === 'number' && typeof req.lng === 'number') {
            origin = { lat: req.lat, lng: req.lng };
        }
        else if (req.district) {
            const dist = await District_1.District.findOne({
                name: { $regex: new RegExp(`^${req.district}$`, 'i') },
            }).lean();
            if (dist) {
                if (req.location) {
                    const area = dist.areas.find((a) => a.name.toLowerCase() === req.location.toLowerCase());
                    if (area?.lat && area?.lng) {
                        origin = { lat: area.lat, lng: area.lng };
                    }
                }
                if (!origin && dist.lat && dist.lng) {
                    origin = { lat: dist.lat, lng: dist.lng };
                }
            }
        }
        // 2. Query suitable approved, online providers
        const query = {
            status: 'approved',
            isActive: true,
            isOnline: true,
            $or: [{ category: req.category }, { secondaryCategories: req.category }],
        };
        if (req.district) {
            query.$and = [
                {
                    $or: [
                        { 'coverage.isAllDistricts': true },
                        {
                            'coverage.districts': {
                                $in: [req.district, 'All', new RegExp(`^${req.district}$`, 'i')],
                            },
                        },
                    ],
                },
            ];
        }
        const candidateProviders = (await Provider_1.Provider.find(query).lean());
        // 3. Dates & availability check
        const dates = (0, dates_1.eachDay)(req.eventDate, req.eventEndDate || req.eventDate);
        const candidateIds = candidateProviders.map((p) => p._id);
        const bookedDays = await ProviderAvailability_1.ProviderAvailability.find({
            providerId: { $in: candidateIds },
            date: { $in: dates },
        }).lean();
        const bookedMap = new Map();
        for (const b of bookedDays) {
            const pid = b.providerId.toString();
            if (!bookedMap.has(pid)) {
                bookedMap.set(pid, []);
            }
            bookedMap.get(pid).push(b.date);
        }
        const today = (0, dates_1.todayIST)();
        // 4. Score and filter candidates
        const matchedList = [];
        const effectiveGuests = req.category === 'makeup' ? req.makeupPersonsCount || 1 : req.guestCount || 1;
        for (const p of candidateProviders) {
            const pid = p._id.toString();
            // Capacity filters
            if (req.category === 'makeup') {
                const persons = req.makeupPersonsCount || 1;
                if (p.maxCapacity && persons > p.maxCapacity)
                    continue;
                if (req.simultaneousStyling && p.maxDailyClients && persons > p.maxDailyClients) {
                    continue;
                }
            }
            else {
                if (p.minCapacity && effectiveGuests < p.minCapacity)
                    continue;
                if (p.maxCapacity && effectiveGuests > p.maxCapacity)
                    continue;
            }
            // Calculate estimated starting total
            const pricingModel = p.pricing?.model || 'per_plate';
            const startingPrice = p.pricing?.startingPrice || 0;
            let estimatedStartingTotal = startingPrice;
            if (pricingModel === 'per_plate') {
                estimatedStartingTotal = startingPrice * effectiveGuests;
            }
            else if (pricingModel === 'hourly') {
                estimatedStartingTotal = startingPrice * 4;
            }
            // Budget filter
            if (req.budgetMax && req.budgetMax > 0) {
                if (estimatedStartingTotal > req.budgetMax * 1.2) {
                    continue;
                }
            }
            // Availability check
            const noticeDays = p.settings?.advanceNoticeDays ?? 3;
            const minDate = (0, dayjs_1.default)(today).add(noticeDays, 'day').format('YYYY-MM-DD');
            const unavailableFromNotice = dates.filter((d) => d < minDate);
            const bookedFromDb = bookedMap.get(pid) || [];
            const unavailableDates = Array.from(new Set([...bookedFromDb, ...unavailableFromNotice]));
            const isAvailable = unavailableDates.length === 0;
            // Distance
            let distanceKm = null;
            if (origin && p.geo?.lat && p.geo?.lng) {
                distanceKm = (0, distance_1.haversineKm)(origin, { lat: p.geo.lat, lng: p.geo.lng });
            }
            // Relevance Score (0 - 100)
            // 1. Rating * 8 (max 40)
            const ratingPart = (p.rating || 0) * 8;
            // 2. Distance score (max 30)
            let distPart = 15;
            if (distanceKm !== null) {
                distPart = Math.max(0, 1 - distanceKm / 50) * 30;
            }
            // 3. Price fit (max 20)
            let pricePart = 10;
            if (req.budgetMin !== undefined && req.budgetMax !== undefined && req.budgetMax > 0) {
                if (estimatedStartingTotal >= req.budgetMin &&
                    estimatedStartingTotal <= req.budgetMax) {
                    pricePart = 20;
                }
                else if (estimatedStartingTotal < req.budgetMin) {
                    pricePart = 15;
                }
                else {
                    const ratio = (estimatedStartingTotal - req.budgetMax) / (req.budgetMax * 0.2);
                    pricePart = Math.max(0, 10 * (1 - ratio));
                }
            }
            // 4. Verified (5)
            const verifiedPart = p.verified ? 5 : 0;
            // 5. Responsiveness (5)
            const respPart = (p.avgResponseMinutes || 120) <= 120 ? 5 : 2.5;
            const matchScore = Math.round((ratingPart + distPart + pricePart + verifiedPart + respPart) * 10) / 10;
            const categoriesList = [
                p.category,
                ...(p.secondaryCategories || []),
            ].filter(Boolean);
            const responseTime = (p.avgResponseMinutes || 120) <= 60
                ? 'Usually responds within 1 hour'
                : (p.avgResponseMinutes || 120) <= 120
                    ? 'Usually responds within 2 hours'
                    : 'Usually responds in a few hours';
            matchedList.push({
                id: pid,
                name: p.businessName || 'Service Provider',
                category: p.category || req.category,
                categories: categoriesList,
                tagline: p.tagline,
                rating: p.rating || 0,
                reviewCount: p.reviewCount || 0,
                startingPrice,
                pricingModel,
                verified: p.verified || false,
                isOnline: p.isOnline !== false,
                distanceKm,
                isAvailable,
                unavailableDates: isAvailable ? undefined : unavailableDates,
                coverImage: p.coverImage,
                logoColor: p.logoColor || '#0E7C7B',
                district: p.district,
                areas: p.coverage?.areas || [],
                vegPreference: p.vegPreference || 'both',
                minCapacity: p.minCapacity,
                maxCapacity: p.maxCapacity,
                responseTime,
                estimatedStartingTotal,
                matchScore,
            });
        }
        // 5. Sort: available first, then chosen sort
        matchedList.sort((a, b) => {
            if (a.isAvailable !== b.isAvailable) {
                return a.isAvailable ? -1 : 1;
            }
            if (sortBy === 'rating') {
                return b.rating - a.rating;
            }
            if (sortBy === 'price') {
                return a.estimatedStartingTotal - b.estimatedStartingTotal;
            }
            if (sortBy === 'distance') {
                if (a.distanceKm === null && b.distanceKm === null)
                    return 0;
                if (a.distanceKm === null)
                    return 1;
                if (b.distanceKm === null)
                    return -1;
                return a.distanceKm - b.distanceKm;
            }
            // default: relevance
            return b.matchScore - a.matchScore;
        });
        const totalMatches = matchedList.length;
        const paginatedProviders = matchedList.slice((page - 1) * limit, page * limit);
        return {
            totalMatches,
            providers: paginatedProviders,
            page,
            limit,
            totalPages: Math.ceil(totalMatches / limit) || 1,
        };
    },
};
