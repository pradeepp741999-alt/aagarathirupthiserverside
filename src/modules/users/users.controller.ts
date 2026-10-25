import { Request, Response } from 'express';
import { User } from '@/models/User';
import { District } from '@/models/District';
import { Enquiry } from '@/models/Enquiry';
import { Review } from '@/models/Review';
import { AVATAR_PALETTE } from '@/config/constants';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

async function validateDistrictAndArea(districtName: string, locationName: string) {
  const dist = await District.findOne({
    name: { $regex: new RegExp(`^${districtName.trim()}$`, 'i') },
  }).lean();

  if (!dist) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `District '${districtName}' is not supported`);
  }

  const validArea = dist.areas.find(
    (a) => a.name.toLowerCase() === locationName.trim().toLowerCase()
  );

  if (!validArea) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Location '${locationName}' is not a valid area in ${dist.name}`
    );
  }

  return { dist, validArea };
}

export const usersController = {
  async createProfile(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { name, district, location, whatsapp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    if (user.profileCompleted) {
      throw new AppError(
        409,
        ERROR_CODES.ALREADY_EXISTS,
        'Profile has already been set up. Please use PUT /api/v1/user/profile to update.'
      );
    }

    const { dist, validArea } = await validateDistrictAndArea(district, location);

    const randomColor = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

    user.name = name;
    user.district = dist.name;
    user.location = validArea.name;
    user.whatsapp = whatsapp || user.mobile;
    user.avatarColor = randomColor;
    user.profileCompleted = true;

    if (validArea.lat && validArea.lng) {
      user.geo = { lat: validArea.lat, lng: validArea.lng };
    } else if (dist.lat && dist.lng) {
      user.geo = { lat: dist.lat, lng: dist.lng };
    }

    await user.save();

    return res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        mobile: user.mobile,
        whatsapp: user.whatsapp,
        district: user.district,
        location: user.location,
        avatarColor: user.avatarColor,
      },
    });
  },

  async getProfile(req: Request, res: Response) {
    const userId = req.auth!.sub;

    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const enquiries = await Enquiry.find({ userId: user._id }).lean();
    const reviewsGiven = await Review.countDocuments({ userId: user._id });

    const totalEnquiries = enquiries.length;
    const activeEnquiries = enquiries.filter((e) =>
      ['submitted', 'provider_reviewing', 'quote_sent', 'accepted', 'confirmed'].includes(e.status)
    ).length;
    const completedEvents = enquiries.filter((e) => e.status === 'completed').length;

    return res.status(200).json({
      id: user._id.toString(),
      name: user.name || null,
      mobile: user.mobile,
      whatsapp: user.whatsapp || null,
      altMobile: user.altMobile || null,
      district: user.district || null,
      location: user.location || null,
      avatarColor: user.avatarColor || '#8B5CF6',
      stats: {
        totalEnquiries,
        activeEnquiries,
        completedEvents,
        reviewsGiven,
      },
    });
  },

  async updateProfile(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { name, whatsapp, altMobile, district, location } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const { dist, validArea } = await validateDistrictAndArea(district, location);

    user.name = name;
    user.whatsapp = whatsapp;
    user.altMobile = altMobile || null;
    user.district = dist.name;
    user.location = validArea.name;

    if (validArea.lat && validArea.lng) {
      user.geo = { lat: validArea.lat, lng: validArea.lng };
    }

    await user.save();

    return res.status(200).json({
      id: user._id.toString(),
      name: user.name,
      mobile: user.mobile,
      whatsapp: user.whatsapp,
      altMobile: user.altMobile || null,
      district: user.district,
      location: user.location,
      avatarColor: user.avatarColor,
    });
  },

  async patchLocation(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { district, location, lat, lng } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    if (district && location) {
      const { dist, validArea } = await validateDistrictAndArea(district, location);
      user.district = dist.name;
      user.location = validArea.name;
      if (typeof lat === 'number' && typeof lng === 'number') {
        user.geo = { lat, lng };
      } else if (validArea.lat && validArea.lng) {
        user.geo = { lat: validArea.lat, lng: validArea.lng };
      }
    } else if (typeof lat === 'number' && typeof lng === 'number') {
      user.geo = { lat, lng };
    }

    await user.save();

    return res.status(200).json({
      id: user._id.toString(),
      name: user.name,
      mobile: user.mobile,
      whatsapp: user.whatsapp,
      district: user.district,
      location: user.location,
      avatarColor: user.avatarColor,
      geo: user.geo,
    });
  },
};
