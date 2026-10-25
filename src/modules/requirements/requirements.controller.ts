import { Request, Response } from 'express';
import dayjs from 'dayjs';
import { Category } from '@/models/Category';
import { RequirementDraft } from '@/models/RequirementDraft';
import { todayIST } from '@/common/utils/dates';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const requirementsController = {
  async saveDraft(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const {
      category,
      eventType,
      eventDate,
      eventEndDate,
      district,
      location,
      guestCount,
      makeupPersonsCount,
      simultaneousStyling,
      budgetMin,
      budgetMax,
      notes,
    } = req.body;

    // 1. Category and eventType check
    const catDoc = await Category.findById(category).lean();
    if (!catDoc || !catDoc.isActive) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid or inactive category: ${category}`);
    }

    if (eventType && catDoc.eventTypes && !catDoc.eventTypes.includes(eventType)) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid eventType '${eventType}' for category '${category}'`
      );
    }

    // 2. Dates check
    const today = todayIST();
    if (eventDate < today) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'eventDate must be today or in the future');
    }

    if (eventEndDate) {
      if (eventEndDate < eventDate) {
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed: eventEndDate must be equal or later than eventDate'
        );
      }
      const daysSpan = dayjs(eventEndDate).diff(dayjs(eventDate), 'day') + 1;
      if (daysSpan > 7) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Event date range cannot exceed 7 days');
      }
    }

    // 3. Budget check
    if (typeof budgetMin === 'number' && typeof budgetMax === 'number') {
      if (budgetMin > budgetMax) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'budgetMin cannot be greater than budgetMax');
      }
    }

    // 4. Makeup Staffing Rules (doc 08 §5)
    let staffing: any = undefined;
    let backupArtistAssigned = false;
    let finalGuestCount = guestCount || 1;

    if (category === 'makeup') {
      const persons = makeupPersonsCount || guestCount || 1;
      if (persons < 1) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'makeupPersonsCount must be at least 1');
      }

      finalGuestCount = persons;

      if (simultaneousStyling && persons < 2) {
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'simultaneousStyling requires at least 2 persons'
        );
      }

      if (simultaneousStyling && persons >= 2) {
        backupArtistAssigned = true;
        staffing = {
          leadArtists: 1,
          backupArtists: 1,
          hoursPerPerson: { min: 1.5, max: 2 },
          estimatedHours: { min: 1.5 * Math.ceil(persons / 2), max: 2 * Math.ceil(persons / 2) },
        };
      } else {
        backupArtistAssigned = false;
        staffing = {
          leadArtists: 1,
          backupArtists: 0,
          hoursPerPerson: { min: 1.5, max: 2 },
          estimatedHours: { min: 1.5 * persons, max: 2 * persons },
        };
      }
    }

    const normalizedRequirement = {
      category,
      eventType,
      eventDate,
      eventEndDate: eventEndDate || undefined,
      district,
      location,
      guestCount: finalGuestCount,
      makeupPersonsCount: category === 'makeup' ? finalGuestCount : undefined,
      simultaneousStyling: category === 'makeup' ? !!simultaneousStyling : undefined,
      backupArtistAssigned: category === 'makeup' ? backupArtistAssigned : undefined,
      budgetMin,
      budgetMax,
      notes,
    };

    const draft = await RequirementDraft.create({
      userId,
      payload: normalizedRequirement,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
    });

    return res.status(200).json({
      draftId: draft._id.toString(),
      valid: true,
      requirement: normalizedRequirement,
      staffing,
    });
  },
};
