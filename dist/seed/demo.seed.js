"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = seedDemoData;
const dayjs_1 = __importDefault(require("dayjs"));
const User_1 = require("@/models/User");
const Provider_1 = require("@/models/Provider");
const ProviderDocument_1 = require("@/models/ProviderDocument");
const Dish_1 = require("@/models/Dish");
const MenuPackage_1 = require("@/models/MenuPackage");
const SpecialCombo_1 = require("@/models/SpecialCombo");
const ProviderAvailability_1 = require("@/models/ProviderAvailability");
const Enquiry_1 = require("@/models/Enquiry");
const Booking_1 = require("@/models/Booking");
const Review_1 = require("@/models/Review");
const CrmCustomer_1 = require("@/models/CrmCustomer");
const Notification_1 = require("@/models/Notification");
const crypto_1 = require("@/common/utils/crypto");
const mask_1 = require("@/common/utils/mask");
const dates_1 = require("@/common/utils/dates");
const logger_1 = require("@/config/logger");
async function seedDemoData() {
    logger_1.logger.info('Seeding demo data for Aagara Thirupthi...');
    const today = (0, dates_1.todayIST)();
    // 1. Demo User: Kavitha Rajan
    let user = await User_1.User.findOne({ mobile: '9876543210' });
    if (!user) {
        user = await User_1.User.create({
            mobile: '9876543210',
            name: 'Kavitha Rajan',
            whatsapp: '9876543210',
            district: 'Salem',
            location: 'Fairlands',
            avatarColor: '#8B5CF6',
            profileCompleted: true,
            status: 'active',
            geo: { lat: 11.6748, lng: 78.1402 },
        });
    }
    // 2. Demo Providers
    // Provider 1: Sri Annapoorna Caterers
    let caterer = await Provider_1.Provider.findOne({ mobile: '9000000001' });
    if (!caterer) {
        caterer = await Provider_1.Provider.create({
            mobile: '9000000001',
            businessName: 'Sri Annapoorna Caterers',
            ownerName: 'Venkatesan Sundaram',
            tagline: 'Authentic Traditional Kongunadu & Chettinad Feast',
            description: 'With over 18 years of catering excellence across Salem, Erode, and Coimbatore, we specialize in pure vegetarian and traditional non-vegetarian marriage feasts, live dosa counters, and authentic biryanis.',
            category: 'catering',
            secondaryCategories: [],
            vegPreference: 'both',
            cuisineTypes: ['South Indian', 'Chettinad', 'Kongunadu', 'North Indian'],
            minCapacity: 50,
            maxCapacity: 5000,
            yearsActive: 18,
            pricing: {
                model: 'per_plate',
                startingPrice: 280,
                advancePercentage: 30,
                cancellationPolicy: 'Full refund 15 days prior; 50% refund 7 days prior.',
                paymentTerms: '30% advance on confirmation, 50% on event morning, balance on completion.',
            },
            coverage: {
                districts: ['Salem', 'Namakkal', 'Erode', 'Dharmapuri'],
                isAllDistricts: false,
                areas: ['Fairlands', 'Hasthampatti', 'Alagapuram', 'Attur'],
                travelsOutstation: true,
                outstationFeePerKm: 25,
            },
            district: 'Salem',
            geo: { lat: 11.6643, lng: 78.146 },
            settings: {
                advanceNoticeDays: 3,
                autoAcceptEnquiries: false,
            },
            status: 'approved',
            registrationStep: 7,
            completedSteps: [1, 2, 3, 4, 5, 6],
            verified: true,
            isOnline: true,
            isActive: true,
            rating: 4.8,
            ratingBreakdown: { 1: 0, 2: 1, 3: 2, 4: 10, 5: 35 },
            reviewCount: 48,
            avgResponseMinutes: 45,
        });
    }
    // Documents for Caterer
    await ProviderDocument_1.ProviderDocument.findOneAndUpdate({ providerId: caterer._id, type: 'aadhaar' }, {
        providerId: caterer._id,
        type: 'aadhaar',
        numberEnc: (0, crypto_1.encryptDoc)('987654321098'),
        numberMasked: (0, mask_1.maskDocumentNumber)('aadhaar', '987654321098'),
        fileUrl: 'http://localhost:4000/static/uploads/documents/aadhaar_cat.png',
        status: 'verified',
        verifiedAt: new Date(),
    }, { upsert: true });
    await ProviderDocument_1.ProviderDocument.findOneAndUpdate({ providerId: caterer._id, type: 'fssai' }, {
        providerId: caterer._id,
        type: 'fssai',
        numberEnc: (0, crypto_1.encryptDoc)('12423005000123'),
        numberMasked: (0, mask_1.maskDocumentNumber)('fssai', '12423005000123'),
        fileUrl: 'http://localhost:4000/static/uploads/documents/fssai_cat.png',
        expiryDate: '2027-12-31',
        status: 'verified',
        verifiedAt: new Date(),
    }, { upsert: true });
    // Dishes for Sri Annapoorna
    const sampleDishes = [
        { name: 'Seeraga Samba Mutton Biriyani', category: 'non_veg', price: 280, isVeg: false, isPopular: true },
        { name: 'Salem Special Thalassery Chicken Biryani', category: 'non_veg', price: 240, isVeg: false, isPopular: true },
        { name: 'Elaneer Payasam', category: 'sweets', price: 65, isVeg: true, isPopular: true },
        { name: 'Kongunadu Nattu Kozhi Varuval', category: 'non_veg', price: 160, isVeg: false, isPopular: true },
        { name: 'Traditional Chettinad Chicken Gravy', category: 'curries', price: 140, isVeg: false, isPopular: false },
        { name: 'Paneer Butter Masala', category: 'curries', price: 110, isVeg: true, isPopular: true },
        { name: 'Malabar Parotta (2 pcs)', category: 'breads', price: 40, isVeg: true, isPopular: false },
        { name: 'Mini Ghee Podi Idli (5 pcs)', category: 'starters', price: 60, isVeg: true, isPopular: true },
        { name: 'Curd Rice with Pomegranate', category: 'rice', price: 50, isVeg: true, isPopular: false },
        { name: 'Gulab Jamun with Ice Cream', category: 'sweets', price: 70, isVeg: true, isPopular: true },
        { name: 'Fresh Rose Milk Live Counter', category: 'drinks', price: 45, isVeg: true, isPopular: false },
        { name: 'Crispy Veg Spring Rolls', category: 'starters', price: 75, isVeg: true, isPopular: false },
    ];
    const createdDishIds = [];
    for (const d of sampleDishes) {
        let dishDoc = await Dish_1.Dish.findOne({ providerId: caterer._id, name: d.name });
        if (!dishDoc) {
            dishDoc = await Dish_1.Dish.create({
                providerId: caterer._id,
                ...d,
                isActive: true,
            });
        }
        createdDishIds.push(dishDoc._id);
    }
    // Packages for Sri Annapoorna
    await MenuPackage_1.MenuPackage.findOneAndUpdate({ providerId: caterer._id, name: 'Royal Non-Veg Marriage Feast' }, {
        providerId: caterer._id,
        name: 'Royal Non-Veg Marriage Feast',
        description: 'Comprehensive 12-item grand marriage banquet including Mutton Biryani, chicken gravies, starters, and dessert.',
        pricePerPlate: 450,
        minGuests: 100,
        dishIds: createdDishIds.slice(0, 8),
        isVeg: false,
        isActive: true,
    }, { upsert: true });
    await MenuPackage_1.MenuPackage.findOneAndUpdate({ providerId: caterer._id, name: 'Traditional South Indian Veg Sadhya' }, {
        providerId: caterer._id,
        name: 'Traditional South Indian Veg Sadhya',
        description: 'Authentic banana-leaf vegetarian feast with 16 traditional items, payasam, and live vadai counter.',
        pricePerPlate: 320,
        minGuests: 80,
        dishIds: createdDishIds.filter((_, i) => [2, 5, 6, 7, 8, 9, 10, 11].includes(i)),
        isVeg: true,
        isActive: true,
    }, { upsert: true });
    // Combos for Sri Annapoorna
    await SpecialCombo_1.SpecialCombo.findOneAndUpdate({ providerId: caterer._id, name: 'Grand Wedding Biryani Fest' }, {
        providerId: caterer._id,
        category: 'catering',
        name: 'Grand Wedding Biryani Fest',
        description: 'Special 500-guest biryani feast bundle with complimentary Elaneer Payasam counter.',
        includedItems: [
            'Seeraga Samba Mutton Biriyani',
            'Kongu Nattu Kozhi Varuval',
            'Egg Masala',
            'Brinjal Chutney & Onion Raita',
            'Free Elaneer Payasam Counter',
        ],
        price: 135000,
        originalPrice: 155000,
        imageUrl: 'http://localhost:4000/static/uploads/combos/biryani_fest.png',
        validUntil: (0, dayjs_1.default)(today).add(60, 'day').endOf('day').toDate(),
        badge: 'POPULAR CHOICE',
        isActive: true,
    }, { upsert: true });
    // Provider 2: Glow & Glamour Bridal Studio (Makeup)
    let makeupArtist = await Provider_1.Provider.findOne({ mobile: '9000000002' });
    if (!makeupArtist) {
        makeupArtist = await Provider_1.Provider.create({
            mobile: '9000000002',
            businessName: 'Glow & Glamour Bridal Studio',
            ownerName: 'Deepa Muthukumar',
            tagline: 'Celebrity HD & Airbrush Bridal Makeover Artist',
            description: 'Certified master bridal artist specializing in Muhurtham, reception, and engagement look styling. High-end international makeup products (MAC, NARS, Huda Beauty) with flawless saree draping and hair setting.',
            category: 'makeup',
            secondaryCategories: [],
            maxDailyClients: 3,
            minCapacity: 1,
            maxCapacity: 3,
            yearsActive: 8,
            serviceDetails: {
                specialties: ['HD Bridal Makeup', 'Airbrush Makeup', 'Saree Draping', 'Bridal Hairstyling'],
                bridalTrialOffered: true,
                serviceLocation: 'venue_and_home',
            },
            pricing: {
                model: 'per_event',
                startingPrice: 12000,
                advancePercentage: 30,
                cancellationPolicy: 'Advance is non-refundable; date rescheduling permitted up to 10 days before event.',
                paymentTerms: '30% advance on confirmation, balance after makeover at the venue.',
            },
            coverage: {
                districts: ['Salem', 'Erode', 'Namakkal'],
                isAllDistricts: false,
                areas: ['Fairlands', 'Hasthampatti', 'Alagapuram', 'Junction'],
                travelsOutstation: true,
                outstationFeePerKm: 20,
            },
            district: 'Salem',
            geo: { lat: 11.6748, lng: 78.1402 },
            settings: {
                advanceNoticeDays: 2,
                autoAcceptEnquiries: true,
            },
            status: 'approved',
            registrationStep: 7,
            completedSteps: [1, 2, 3, 4, 5, 6],
            verified: true,
            isOnline: true,
            isActive: true,
            rating: 4.9,
            ratingBreakdown: { 1: 0, 2: 0, 3: 1, 4: 8, 5: 39 },
            reviewCount: 48,
            avgResponseMinutes: 30,
        });
    }
    // Provider 3: Royal Mandap Decors
    let decorator = await Provider_1.Provider.findOne({ mobile: '9000000003' });
    if (!decorator) {
        decorator = await Provider_1.Provider.create({
            mobile: '9000000003',
            businessName: 'Royal Mandap Decors',
            ownerName: 'Karthik Subramaniam',
            tagline: 'Magnificent Floral Mandaps & Stage Lighting',
            category: 'decoration',
            secondaryCategories: [],
            minCapacity: 50,
            maxCapacity: 3000,
            yearsActive: 12,
            pricing: {
                model: 'per_event',
                startingPrice: 20000,
                advancePercentage: 40,
            },
            coverage: {
                districts: ['Salem', 'Namakkal'],
                isAllDistricts: false,
                areas: ['Hasthampatti', 'Fairlands'],
                travelsOutstation: true,
                outstationFeePerKm: 20,
            },
            district: 'Salem',
            geo: { lat: 11.6784, lng: 78.1561 },
            status: 'approved',
            registrationStep: 7,
            completedSteps: [1, 2, 3, 4, 5, 6],
            verified: true,
            isOnline: true,
            isActive: true,
            rating: 4.7,
            reviewCount: 32,
            avgResponseMinutes: 60,
        });
    }
    // Provider 4: Salem Sound Masters
    let audioProvider = await Provider_1.Provider.findOne({ mobile: '9000000004' });
    if (!audioProvider) {
        audioProvider = await Provider_1.Provider.create({
            mobile: '9000000004',
            businessName: 'Salem Sound Masters',
            ownerName: 'Praveen Kumar',
            tagline: 'Concert Quality Line Array Acoustics & DJ Stage',
            category: 'audio',
            secondaryCategories: [],
            minCapacity: 100,
            maxCapacity: 10000,
            yearsActive: 10,
            pricing: {
                model: 'per_event',
                startingPrice: 15000,
                advancePercentage: 30,
            },
            coverage: {
                districts: ['Salem', 'Erode', 'Dharmapuri'],
                isAllDistricts: false,
                areas: ['Junction', 'Shevapet'],
                travelsOutstation: true,
                outstationFeePerKm: 30,
            },
            district: 'Salem',
            geo: { lat: 11.6711, lng: 78.1252 },
            status: 'approved',
            registrationStep: 7,
            completedSteps: [1, 2, 3, 4, 5, 6],
            verified: true,
            isOnline: true,
            isActive: true,
            rating: 4.6,
            reviewCount: 24,
            avgResponseMinutes: 90,
        });
    }
    // Block some availability calendar dates
    const futureBlockedDate1 = (0, dayjs_1.default)(today).add(10, 'day').format('YYYY-MM-DD');
    const futureBlockedDate2 = (0, dayjs_1.default)(today).add(11, 'day').format('YYYY-MM-DD');
    await ProviderAvailability_1.ProviderAvailability.findOneAndUpdate({ providerId: caterer._id, date: futureBlockedDate1 }, {
        providerId: caterer._id,
        date: futureBlockedDate1,
        status: 'blocked',
        note: 'Personal leave / maintenance',
    }, { upsert: true });
    // 3. Demo Enquiry & Booking Lifecycle
    // Enquiry 1: Confirmed Booking with payment
    const bookingDate = (0, dayjs_1.default)(today).add(15, 'day').format('YYYY-MM-DD');
    let enqConfirmed = await Enquiry_1.Enquiry.findOne({ code: 'ENQ-100001' });
    if (!enqConfirmed) {
        enqConfirmed = await Enquiry_1.Enquiry.create({
            code: 'ENQ-100001',
            userId: user._id,
            providerId: caterer._id,
            customer: {
                name: 'Kavitha Rajan',
                mobile: '9876543210',
                whatsapp: '9876543210',
                avatarColor: '#8B5CF6',
            },
            providerSnapshot: {
                businessName: caterer.businessName,
                category: 'catering',
            },
            category: 'catering',
            eventType: 'Wedding Reception',
            location: 'Subhashree Mahal, Fairlands',
            district: 'Salem',
            eventDate: bookingDate,
            eventTime: '18:30',
            mealType: 'dinner',
            guestCount: 350,
            items: [
                { name: 'Royal Non-Veg Marriage Feast', price: 450, qty: 350 },
            ],
            estimatedTotal: 157500,
            status: 'confirmed',
            quote: {
                amount: 157500,
                validUntil: bookingDate,
                inclusions: ['Welcome drink', 'Full buffet setup', 'Serving staff'],
                sentAt: new Date(),
            },
            timeline: [
                { kind: 'status', status: 'submitted', author: 'customer', message: 'Enquiry submitted by user', at: new Date() },
                { kind: 'status', status: 'quote_sent', author: 'provider', message: 'Quote submitted', at: new Date() },
                { kind: 'status', status: 'accepted', author: 'customer', message: 'Customer accepted the quote', at: new Date() },
                { kind: 'status', status: 'confirmed', author: 'provider', message: 'Booking confirmed', at: new Date() },
            ],
            isNewLead: false,
            staleReminderSent: false,
        });
    }
    // Booking row
    let bookingDoc = await Booking_1.Booking.findOne({ code: 'BKG-100001' });
    if (!bookingDoc) {
        bookingDoc = await Booking_1.Booking.create({
            code: 'BKG-100001',
            enquiryId: enqConfirmed._id,
            providerId: caterer._id,
            userId: user._id,
            customer: {
                name: 'Kavitha Rajan',
                mobile: '9876543210',
                whatsapp: '9876543210',
                avatarColor: '#8B5CF6',
            },
            category: 'catering',
            eventType: 'Wedding Reception',
            eventDate: bookingDate,
            startTime: '18:30',
            venue: 'Subhashree Mahal, Fairlands',
            guestCount: 350,
            totalAmount: 157500,
            advanceRequired: 47250,
            payments: [
                {
                    amount: 50000,
                    method: 'upi',
                    referenceId: 'UPI-DEMO-481726354',
                    notes: 'Initial 30% advance paid',
                    receiptNo: 'REC-100001',
                    paidAt: new Date(),
                },
            ],
            advancePaid: 50000,
            balanceDue: 107500,
            paymentStatus: 'partially_paid',
            status: 'confirmed',
        });
        enqConfirmed.bookingId = bookingDoc._id;
        await enqConfirmed.save();
        await ProviderAvailability_1.ProviderAvailability.findOneAndUpdate({ providerId: caterer._id, date: bookingDate }, {
            providerId: caterer._id,
            date: bookingDate,
            status: 'booked',
            bookingId: bookingDoc._id,
            note: 'Kavitha Rajan Wedding Reception',
        }, { upsert: true });
    }
    // Enquiry 2: Completed Event with Review & Reply
    const pastDate = (0, dayjs_1.default)(today).subtract(7, 'day').format('YYYY-MM-DD');
    let enqCompleted = await Enquiry_1.Enquiry.findOne({ code: 'ENQ-100002' });
    if (!enqCompleted) {
        enqCompleted = await Enquiry_1.Enquiry.create({
            code: 'ENQ-100002',
            userId: user._id,
            providerId: makeupArtist._id,
            customer: {
                name: 'Kavitha Rajan',
                mobile: '9876543210',
                whatsapp: '9876543210',
                avatarColor: '#8B5CF6',
            },
            providerSnapshot: {
                businessName: makeupArtist.businessName,
                category: 'makeup',
            },
            category: 'makeup',
            eventType: 'Engagement',
            location: 'Fairlands, Salem',
            district: 'Salem',
            eventDate: pastDate,
            guestCount: 1,
            makeupPersonsCount: 1,
            simultaneousStyling: false,
            items: [{ name: 'HD Bridal Makeover', price: 12000, qty: 1 }],
            estimatedTotal: 12000,
            status: 'completed',
            quote: {
                amount: 12000,
                inclusions: ['HD Makeup', 'Saree Draping', 'Hairstyling'],
                sentAt: new Date(Date.now() - 10 * 86400000),
            },
            timeline: [
                { kind: 'status', status: 'submitted', author: 'customer', message: 'Enquiry submitted', at: new Date() },
                { kind: 'status', status: 'confirmed', author: 'provider', message: 'Booking confirmed', at: new Date() },
                { kind: 'status', status: 'completed', author: 'provider', message: 'Makeover successfully completed', at: new Date() },
            ],
            isNewLead: false,
            staleReminderSent: false,
            hasReview: true,
        });
        // Review
        const review = await Review_1.Review.create({
            providerId: makeupArtist._id,
            userId: user._id,
            enquiryId: enqCompleted._id,
            customerName: 'Kavitha Rajan',
            avatarColor: '#8B5CF6',
            eventType: 'Engagement',
            rating: 5,
            ratings: {
                quality: 5,
                communication: 5,
                value: 5,
                timeliness: 5,
            },
            comment: 'Deepa did an extraordinary job for my engagement! Flawless HD finish that lasted the entire evening without any touchups. Highly recommended in Salem!',
            photos: [],
            providerReply: {
                text: 'Thank you so much Kavitha! It was an absolute delight styling you for your special day.',
                repliedAt: new Date(),
            },
            status: 'published',
        });
        enqCompleted.reviewId = review._id;
        await enqCompleted.save();
    }
    // Sync CRM for caterer and makeup artist
    await CrmCustomer_1.CrmCustomer.findOneAndUpdate({ providerId: caterer._id, mobile: '9876543210' }, {
        providerId: caterer._id,
        userId: user._id,
        name: 'Kavitha Rajan',
        mobile: '9876543210',
        district: 'Salem',
        city: 'Salem',
        avatarColor: '#8B5CF6',
        stage: 'booked',
        totalEnquiries: 1,
        totalBookings: 1,
        totalSpent: 50000,
        lastEventDate: bookingDate,
        lastContactAt: new Date(),
        tags: ['recent'],
    }, { upsert: true });
    // Notifications
    await Notification_1.Notification.create({
        recipientRole: 'user',
        recipientId: user._id,
        type: 'booking',
        title: 'Booking Confirmed!',
        message: 'Sri Annapoorna Caterers confirmed your Wedding Reception on ' + bookingDate,
        referenceType: 'booking',
        referenceId: bookingDoc?._id?.toString(),
        isRead: false,
    });
    logger_1.logger.info('Demo data seeded successfully!');
}
