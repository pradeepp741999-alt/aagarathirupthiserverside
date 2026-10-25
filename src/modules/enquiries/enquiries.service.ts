import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Enquiry, IEnquiry, IEnquiryTimeline } from '@/models/Enquiry';
import { Provider } from '@/models/Provider';
import { User } from '@/models/User';
import { Booking } from '@/models/Booking';
import { Dish } from '@/models/Dish';
import { MenuPackage } from '@/models/MenuPackage';
import { calendarService } from '@/services/calendar.service';
import { crmSyncService } from '@/services/crm.sync.service';
import { notifyService } from '@/services/notify.service';
import { nextCode } from '@/common/utils/counters';
import { todayIST, formatDisplayDate, eachDay } from '@/common/utils/dates';
import { formatINR } from '@/common/utils/money';
import { CanonicalEnquiryStatus } from '@/config/constants';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const enquiriesService = {
  async submitEnquiry(userId: string, body: any) {
    const {
      providerId,
      category,
      eventType,
      location,
      district,
      eventDate,
      eventEndDate,
      eventTime,
      mealType,
      guestCount,
      makeupPersonsCount,
      simultaneousStyling,
      budgetMin,
      budgetMax,
      notes,
      items: rawItems,
    } = body;

    // 1. Provider existence and online status
    const provider = await Provider.findById(providerId);
    if (!provider || provider.status !== 'approved' || !provider.isActive) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found or not currently active');
    }
    if (provider.isOnline === false) {
      throw new AppError(409, ERROR_CODES.PROVIDER_NOT_ACCEPTING, 'Provider is currently not accepting new enquiries');
    }

    // 2. Category match
    const validCategories = [provider.category, ...(provider.secondaryCategories || [])];
    if (!validCategories.includes(category)) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        `Provider does not offer services for category: ${category}`
      );
    }

    // 3. Notice days check
    const today = todayIST();
    if (eventDate < today) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'eventDate cannot be in the past');
    }

    const noticeDays = provider.settings?.advanceNoticeDays ?? 3;
    const minBookableDate = dayjs(today).add(noticeDays, 'day').format('YYYY-MM-DD');
    if (eventDate < minBookableDate) {
      throw new AppError(
        422,
        ERROR_CODES.INSUFFICIENT_NOTICE,
        `Provider requires at least ${noticeDays} days advance notice`
      );
    }

    // 4. Availability check
    const availability = await calendarService.checkRangeAvailability(
      provider._id,
      eventDate,
      eventEndDate || eventDate
    );
    if (!availability.isAvailable) {
      throw new AppError(
        409,
        ERROR_CODES.DATE_UNAVAILABLE,
        'Selected dates are unavailable or in provider notice period',
        { unavailableDates: availability.blockedDates }
      );
    }

    // 5. Capacity check
    const effectiveGuests = category === 'makeup' ? makeupPersonsCount || 1 : guestCount || 1;
    if (category === 'makeup') {
      if (provider.maxCapacity && effectiveGuests > provider.maxCapacity) {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          `Provider max capacity is ${provider.maxCapacity} clients for makeup`
        );
      }
    } else {
      if (provider.minCapacity && effectiveGuests < provider.minCapacity) {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          `Provider requires minimum ${provider.minCapacity} guests`
        );
      }
      if (provider.maxCapacity && effectiveGuests > provider.maxCapacity) {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          `Provider max guest capacity is ${provider.maxCapacity}`
        );
      }
    }

    // 6. Items verification and server-computed total
    const verifiedItems: any[] = [];
    let estimatedTotal = 0;

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (const it of rawItems) {
        let price = it.price || 0;
        const qty = Math.max(1, it.qty || it.quantity || 1);

        if (it.dishId) {
          const dish = await Dish.findOne({ _id: it.dishId, providerId: provider._id }).lean();
          if (dish) {
            price = dish.price;
          }
        } else if (it.packageId) {
          const pkg = await MenuPackage.findOne({ _id: it.packageId, providerId: provider._id }).lean();
          if (pkg) {
            price = pkg.pricePerPlate;
          }
        }

        estimatedTotal += price * qty;
        verifiedItems.push({
          dishId: it.dishId ? new mongoose.Types.ObjectId(it.dishId) : undefined,
          packageId: it.packageId ? new mongoose.Types.ObjectId(it.packageId) : undefined,
          name: it.name,
          price,
          qty,
        });
      }
    } else {
      // Default to starting price
      if (provider.pricing?.model === 'per_plate') {
        estimatedTotal = (provider.pricing.startingPrice || 0) * effectiveGuests;
      } else {
        estimatedTotal = provider.pricing?.startingPrice || 0;
      }
    }

    // 7. Makeup staffing logic
    let staffing: any = undefined;
    let backupArtistAssigned = false;
    if (category === 'makeup') {
      const persons = makeupPersonsCount || 1;
      if (simultaneousStyling && persons >= 2) {
        backupArtistAssigned = true;
        staffing = {
          leadArtists: 1,
          backupArtists: 1,
          hoursPerPerson: { min: 1.5, max: 2 },
          estimatedHours: { min: 1.5 * Math.ceil(persons / 2), max: 2 * Math.ceil(persons / 2) },
        };
      } else {
        staffing = {
          leadArtists: 1,
          backupArtists: 0,
          hoursPerPerson: { min: 1.5, max: 2 },
          estimatedHours: { min: 1.5 * persons, max: 2 * persons },
        };
      }
    }

    // 8. Duplicate guard: same user + provider + eventDate with non-terminal status
    const existing = await Enquiry.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      providerId: provider._id,
      eventDate,
      status: { $nin: ['completed', 'cancelled', 'rejected'] },
    });

    if (existing) {
      throw new AppError(
        409,
        ERROR_CODES.ALREADY_EXISTS,
        'You already have an active enquiry with this provider for this date'
      );
    }

    const user = await User.findById(userId).lean();
    const customerSnapshot = {
      name: user?.name || 'Customer',
      mobile: user?.mobile || '',
      whatsapp: user?.whatsapp || user?.mobile || '',
      email: undefined,
      avatarColor: user?.avatarColor || '#8B5CF6',
    };

    const initialStatus: CanonicalEnquiryStatus = provider.settings?.autoAcceptEnquiries
      ? 'provider_reviewing'
      : 'submitted';

    const timeline: IEnquiryTimeline[] = [
      {
        kind: 'status',
        status: 'submitted',
        author: 'customer',
        message: 'Enquiry submitted by user',
        at: new Date(),
      },
    ];

    if (initialStatus === 'provider_reviewing') {
      timeline.push({
        kind: 'status',
        status: 'provider_reviewing',
        author: 'system',
        message: 'Enquiry automatically accepted for provider review',
        at: new Date(),
      });
    }

    const code = await nextCode('enquiry');

    const enquiry = await Enquiry.create({
      code,
      userId: new mongoose.Types.ObjectId(userId),
      providerId: provider._id,
      customer: customerSnapshot,
      providerSnapshot: {
        businessName: provider.businessName,
        category: provider.category,
      },
      category,
      eventType,
      location,
      district,
      eventDate,
      eventEndDate,
      eventTime,
      mealType,
      guestCount: effectiveGuests,
      makeupPersonsCount: category === 'makeup' ? effectiveGuests : undefined,
      simultaneousStyling: category === 'makeup' ? !!simultaneousStyling : undefined,
      backupArtistAssigned: category === 'makeup' ? backupArtistAssigned : undefined,
      staffing,
      items: verifiedItems,
      estimatedTotal,
      budgetMin,
      budgetMax,
      notes,
      status: initialStatus,
      timeline,
      isNewLead: true,
      staleReminderSent: false,
    });

    // CRM sync and notify
    await crmSyncService.recompute(provider._id, customerSnapshot.mobile);

    notifyService
      .createNotification({
        recipientRole: 'provider',
        recipientId: provider._id,
        type: 'new_enquiry',
        title: `New Enquiry from ${customerSnapshot.name}`,
        message: `${eventType} for ${effectiveGuests} guests on ${formatDisplayDate(eventDate)}`,
        referenceType: 'enquiry',
        referenceId: enquiry._id,
      })
      .catch(() => {});

    return enquiry;
  },

  async confirmBookingFromEnquiry(enquiry: IEnquiry, provider: any) {
    const dates = eachDay(enquiry.eventDate, enquiry.eventEndDate || enquiry.eventDate);

    // Verify all days free
    const avail = await calendarService.checkRangeAvailability(
      provider._id,
      enquiry.eventDate,
      enquiry.eventEndDate || enquiry.eventDate
    );

    if (!avail.isAvailable) {
      throw new AppError(
        409,
        ERROR_CODES.DATE_ALREADY_BOOKED,
        `Date(s) are already booked or unavailable: ${avail.blockedDates.join(', ')}`
      );
    }

    const totalAmount = enquiry.quote?.amount ?? enquiry.estimatedTotal;
    const advancePercentage = provider.pricing?.advancePercentage || 30;
    const advanceRequired = Math.round((totalAmount * advancePercentage) / 100);
    const bookingCode = await nextCode('booking');

    const booking = await Booking.create({
      code: bookingCode,
      enquiryId: enquiry._id,
      providerId: provider._id,
      userId: enquiry.userId,
      customer: {
        name: enquiry.customer.name || 'Customer',
        mobile: enquiry.customer.mobile,
        whatsapp: enquiry.customer.whatsapp || undefined,
        email: enquiry.customer.email || undefined,
        avatarColor: enquiry.customer.avatarColor || undefined,
      },
      category: enquiry.category,
      eventType: enquiry.eventType,
      eventDate: enquiry.eventDate,
      eventEndDate: enquiry.eventEndDate,
      startTime: enquiry.eventTime,
      venue: enquiry.location,
      guestCount: enquiry.guestCount,
      totalAmount,
      advanceRequired,
      payments: [],
      advancePaid: 0,
      balanceDue: totalAmount,
      paymentStatus: 'unpaid',
      status: 'confirmed',
    });

    // Block dates
    await calendarService.blockDates(
      provider._id,
      dates,
      booking._id as mongoose.Types.ObjectId,
      `${enquiry.customer.name || 'Customer'} ${enquiry.eventType}`
    );

    enquiry.status = 'confirmed';
    enquiry.bookingId = booking._id as mongoose.Types.ObjectId;
    enquiry.timeline.push({
      kind: 'status',
      status: 'confirmed',
      author: 'provider',
      message: 'Booking confirmed',
      at: new Date(),
    });
    await enquiry.save();

    await crmSyncService.recompute(provider._id, enquiry.customer.mobile);

    notifyService
      .createNotification({
        recipientRole: 'user',
        recipientId: enquiry.userId,
        type: 'booking',
        title: 'Booking confirmed!',
        message: `${provider.businessName} confirmed your ${enquiry.eventType} on ${formatDisplayDate(enquiry.eventDate)}`,
        referenceType: 'booking',
        referenceId: booking._id,
      })
      .catch(() => {});

    return booking;
  },
};
