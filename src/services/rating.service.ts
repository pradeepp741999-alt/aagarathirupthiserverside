import mongoose from 'mongoose';
import { Review } from '@/models/Review';
import { Provider } from '@/models/Provider';

export const ratingService = {
  async recompute(providerId: string | mongoose.Types.ObjectId): Promise<void> {
    const objectId = new mongoose.Types.ObjectId(providerId);

    const reviews = await Review.find({
      providerId: objectId,
      status: 'published',
    }).select('rating ratings').lean();

    const reviewCount = reviews.length;
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (reviewCount === 0) {
      await Provider.findByIdAndUpdate(objectId, {
        rating: 0,
        reviewCount: 0,
        ratingBreakdown: breakdown,
      });
      return;
    }

    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
    }

    const avg = Math.round((sum / reviewCount) * 10) / 10;

    await Provider.findByIdAndUpdate(objectId, {
      rating: avg,
      reviewCount,
      ratingBreakdown: breakdown,
    });
  },

  async getReviewSummary(providerId: string | mongoose.Types.ObjectId) {
    const objectId = new mongoose.Types.ObjectId(providerId);
    const reviews = await Review.find({
      providerId: objectId,
      status: 'published',
    }).lean();

    const totalReviews = reviews.length;
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const pillars = { quality: 0, communication: 0, value: 0, timeliness: 0 };

    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        breakdownProvider: { '1_star': 0, '2_star': 0, '3_star': 0, '4_star': 0, '5_star': 0 },
        pillars: { quality: 0, communication: 0, value: 0, timeliness: 0 },
      };
    }

    let sumRating = 0;
    let sumQuality = 0;
    let sumComm = 0;
    let sumValue = 0;
    let sumTime = 0;

    for (const r of reviews) {
      sumRating += r.rating;
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
      sumQuality += r.ratings?.quality ?? r.rating;
      sumComm += r.ratings?.communication ?? r.rating;
      sumValue += r.ratings?.value ?? r.rating;
      sumTime += r.ratings?.timeliness ?? r.rating;
    }

    const round1 = (val: number) => Math.round((val / totalReviews) * 10) / 10;

    return {
      averageRating: round1(sumRating),
      totalReviews,
      breakdown: {
        '1': breakdown[1],
        '2': breakdown[2],
        '3': breakdown[3],
        '4': breakdown[4],
        '5': breakdown[5],
      },
      breakdownProvider: {
        '1_star': breakdown[1],
        '2_star': breakdown[2],
        '3_star': breakdown[3],
        '4_star': breakdown[4],
        '5_star': breakdown[5],
      },
      pillars: {
        quality: round1(sumQuality),
        communication: round1(sumComm),
        value: round1(sumValue),
        timeliness: round1(sumTime),
      },
    };
  },
};
