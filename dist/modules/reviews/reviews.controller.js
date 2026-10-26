"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Review_1 = require("@/models/Review");
const Enquiry_1 = require("@/models/Enquiry");
const Provider_1 = require("@/models/Provider");
const User_1 = require("@/models/User");
const rating_service_1 = require("@/services/rating.service");
const notify_service_1 = require("@/services/notify.service");
const storage_1 = require("@/services/storage");
const pagination_1 = require("@/common/http/pagination");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.reviewsController = {
    // POST /reviews (user)
    async submitReview(req, res) {
        const userId = req.auth.sub;
        const { enquiryId, providerId, rating, comment, photos, ratings } = req.body;
        if (!enquiryId || !providerId) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'enquiryId and providerId are required');
        }
        if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'rating must be an integer between 1 and 5');
        }
        if (!comment || comment.trim().length < 10 || comment.trim().length > 1000) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'comment must be between 10 and 1000 characters');
        }
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: enquiryId,
            userId: new mongoose_1.default.Types.ObjectId(userId),
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        if (enquiry.status !== 'completed') {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.NOT_REVIEWABLE, 'Only completed events can be reviewed');
        }
        const existingReview = await Review_1.Review.findOne({ enquiryId });
        if (existingReview) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.REVIEW_ALREADY_EXISTS, 'A review has already been submitted for this event enquiry');
        }
        const validatedPhotos = [];
        if (Array.isArray(photos)) {
            if (photos.length > 4) {
                throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Maximum 4 review photos allowed');
            }
            for (const p of photos) {
                await storage_1.storage.assertOwned(p, {
                    ownerRole: 'user',
                    ownerId: userId,
                });
                validatedPhotos.push(p);
            }
        }
        const user = await User_1.User.findById(userId).lean();
        const customerName = user?.name || enquiry.customer?.name || 'Customer';
        const avatarColor = user?.avatarColor || enquiry.customer?.avatarColor || '#8B5CF6';
        const defaultRatings = {
            quality: rating,
            communication: rating,
            value: rating,
            timeliness: rating,
        };
        const finalRatings = ratings
            ? {
                quality: ratings.quality || rating,
                communication: ratings.communication || rating,
                value: ratings.value || rating,
                timeliness: ratings.timeliness || rating,
            }
            : defaultRatings;
        const review = await Review_1.Review.create({
            providerId: enquiry.providerId,
            userId: enquiry.userId,
            enquiryId: enquiry._id,
            bookingId: enquiry.bookingId,
            customerName,
            avatarColor,
            eventType: enquiry.eventType,
            rating,
            ratings: finalRatings,
            comment: comment.trim(),
            photos: validatedPhotos,
            status: 'published',
        });
        enquiry.hasReview = true;
        enquiry.reviewId = review._id;
        await enquiry.save();
        await rating_service_1.ratingService.recompute(enquiry.providerId);
        const firstSnippet = comment.trim().slice(0, 80);
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'provider',
            recipientId: enquiry.providerId,
            type: 'review',
            title: `New ${rating}★ review`,
            message: `${customerName}: "${firstSnippet}"`,
            referenceType: 'review',
            referenceId: review._id,
        })
            .catch(() => { });
        return res.status(201).json({
            success: true,
            review: {
                id: review._id.toString(),
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt.toISOString(),
            },
        });
    },
    // GET /providers/reviews (provider)
    async getProviderReviews(req, res) {
        const providerId = req.auth.sub;
        const { rating } = req.query;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const query = {
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            status: 'published',
        };
        if (rating && rating !== 'all') {
            query.rating = parseInt(rating, 10);
        }
        const [reviews, total] = await Promise.all([
            Review_1.Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Review_1.Review.countDocuments(query),
        ]);
        const items = reviews.map((r) => ({
            id: r._id.toString(),
            customerName: r.customerName,
            rating: r.rating,
            eventType: r.eventType || '',
            comment: r.comment,
            createdAt: r.createdAt.toISOString(),
            providerReply: r.providerReply?.text || null,
            providerReplyAt: r.providerReply?.repliedAt ? r.providerReply.repliedAt.toISOString() : null,
        }));
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
    // GET /providers/reviews/summary (provider)
    async getProviderReviewsSummary(req, res) {
        const providerId = req.auth.sub;
        const summary = await rating_service_1.ratingService.getReviewSummary(providerId);
        return respond_1.respond.ok(req, res, {
            averageRating: summary.averageRating,
            totalReviews: summary.totalReviews,
            breakdown: summary.breakdownProvider,
        });
    },
    // POST /providers/reviews/:id/reply (provider)
    async replyToReview(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const { replyText, reply_text } = req.body;
        const text = replyText || reply_text;
        if (!text || text.trim().length === 0 || text.trim().length > 500) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'reply_text must be between 1 and 500 characters');
        }
        const review = await Review_1.Review.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!review) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Review not found');
        }
        if (review.providerReply) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.REPLY_ALREADY_EXISTS, 'You have already replied to this review');
        }
        const now = new Date();
        review.providerReply = {
            text: text.trim(),
            repliedAt: now,
        };
        await review.save();
        const provider = await Provider_1.Provider.findById(providerId).lean();
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'user',
            recipientId: review.userId,
            type: 'review',
            title: 'Provider replied',
            message: `${provider?.businessName || 'Provider'} replied to your review`,
            referenceType: 'review',
            referenceId: review._id,
        })
            .catch(() => { });
        return respond_1.respond.ok(req, res, undefined, {
            message: 'Reply published',
        });
    },
};
