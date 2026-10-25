import { Request, Response } from 'express';
import { Provider } from '@/models/Provider';
import { ProviderDocument } from '@/models/ProviderDocument';
import { District } from '@/models/District';
import { storage } from '@/services/storage';
import { encryptDoc } from '@/common/utils/crypto';
import { maskDocumentNumber } from '@/common/utils/mask';
import { REQUIRED_DOC_TYPES } from '@/config/constants';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  submitRegistrationSchema,
} from './registration.validation';

export const registrationController = {
  async getDraft(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const docs = await ProviderDocument.find({ providerId: provider._id }).lean();
    const docsSummary: Record<string, boolean> = {
      aadhaar: false,
      pan: false,
      gst: false,
      tradeLicense: false,
      fssai: false,
    };
    for (const d of docs) {
      if (d.type === 'trade_license') docsSummary.tradeLicense = true;
      else docsSummary[d.type] = true;
    }

    const draft = {
      registrationStep: provider.registrationStep,
      completedSteps: provider.completedSteps || [],
      businessName: provider.businessName || null,
      ownerName: provider.ownerName || null,
      whatsapp: provider.whatsapp || null,
      email: provider.email || null,
      district: provider.district || null,
      description: provider.description || null,
      tagline: provider.tagline || null,
      primaryCategory: provider.category || null,
      secondaryCategories: provider.secondaryCategories || [],
      serviceDetails: provider.serviceDetails || {},
      vegPreference: provider.vegPreference || null,
      cuisineTypes: provider.cuisineTypes || [],
      minCapacity: provider.minCapacity || null,
      maxCapacity: provider.maxCapacity || null,
      maxDailyClients: provider.maxDailyClients || null,
      yearsActive: provider.yearsActive || null,
      pricing: provider.pricing,
      coverage: provider.coverage,
      documents: docsSummary,
    };

    return respond.ok(req, res, draft);
  },

  async saveStep(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const stepNum = parseInt(req.params.n, 10);

    if (isNaN(stepNum) || stepNum < 1 || stepNum > 6) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Step number must be between 1 and 6');
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    if (!['draft', 'rejected'].includes(provider.status)) {
      throw new AppError(
        409,
        ERROR_CODES.REGISTRATION_LOCKED,
        'Registration is currently under review or already approved. Cannot modify steps.'
      );
    }

    if (stepNum > provider.registrationStep) {
      throw new AppError(
        422,
        ERROR_CODES.PREVIOUS_STEP_INCOMPLETE,
        `Cannot skip to step ${stepNum}. Please complete step ${provider.registrationStep} first.`
      );
    }

    // Step-specific validation and persistence
    if (stepNum === 1) {
      const parsed = step1Schema.parse(req.body);
      const dist = await District.findOne({
        name: { $regex: new RegExp(`^${parsed.district.trim()}$`, 'i') },
      }).lean();

      if (!dist) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, `District '${parsed.district}' is not supported`);
      }

      provider.businessName = parsed.businessName;
      provider.ownerName = parsed.ownerName;
      provider.whatsapp = parsed.whatsapp;
      provider.email = parsed.email || undefined;
      provider.district = dist.name;
      provider.description = parsed.description;
      provider.tagline = parsed.tagline;

      if (dist.lat && dist.lng) {
        provider.geo = { lat: dist.lat, lng: dist.lng };
      }
    } else if (stepNum === 2) {
      const parsed = step2Schema.parse(req.body);
      provider.category = parsed.primaryCategory;
      provider.secondaryCategories = parsed.secondaryCategories.filter(
        (c) => c !== parsed.primaryCategory
      );
    } else if (stepNum === 3) {
      const parsed = step3Schema.parse(req.body);
      const cat = provider.category;

      if (cat === 'catering') {
        if (!parsed.vegPreference) {
          throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'veg_preference is required for catering');
        }
        provider.vegPreference = parsed.vegPreference;
        provider.cuisineTypes = parsed.cuisineTypes || [];
        provider.minCapacity = parsed.minCapacity || 1;
        provider.maxCapacity = Math.max(parsed.maxCapacity || 1, provider.minCapacity);
        provider.yearsActive = parsed.yearsActive || 0;
      } else if (cat === 'makeup') {
        const specialties = parsed.makeupSpecialties || parsed.specialties || [];
        if (specialties.length === 0) {
          throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'At least one makeup specialty is required');
        }
        provider.serviceDetails = {
          specialties,
          bridalTrialOffered: !!parsed.bridalTrialOffered,
          serviceLocation: parsed.serviceLocation || 'venue',
        };
        provider.maxDailyClients = parsed.maxDailyClients || 3;
        provider.minCapacity = 1;
        provider.maxCapacity = provider.maxDailyClients;
        provider.yearsActive = parsed.yearsActive || 0;
      } else {
        // decoration or audio
        provider.serviceDetails = { specialties: parsed.specialties || [] };
        provider.yearsActive = parsed.yearsActive || 0;
        if (parsed.minCapacity) provider.minCapacity = parsed.minCapacity;
        if (parsed.maxCapacity) provider.maxCapacity = parsed.maxCapacity;
      }
    } else if (stepNum === 4) {
      const parsed = step4Schema.parse(req.body);
      provider.pricing = {
        model: parsed.pricingModel,
        startingPrice: parsed.startingPrice,
        advancePercentage: parsed.advancePercentage,
        cancellationPolicy: parsed.cancellationPolicy,
        paymentTerms: parsed.paymentTerms,
      };
    } else if (stepNum === 5) {
      const parsed = step5Schema.parse(req.body);
      const isAll = parsed.districts.includes('All') || parsed.districts.length >= 38;

      provider.coverage = {
        districts: parsed.districts,
        isAllDistricts: isAll,
        areas: parsed.serviceAreas,
        travelsOutstation: parsed.travelsOutstation,
        outstationFeePerKm: parsed.outstationFeePerKm,
      };

      // If coverage areas provided and has district, update geo if coords exist
      if (parsed.serviceAreas.length > 0 && provider.district) {
        const dist = await District.findOne({
          name: { $regex: new RegExp(`^${provider.district}$`, 'i') },
        }).lean();
        if (dist) {
          const areaMatch = dist.areas.find(
            (a) => a.name.toLowerCase() === parsed.serviceAreas[0].toLowerCase()
          );
          if (areaMatch?.lat && areaMatch?.lng) {
            provider.geo = { lat: areaMatch.lat, lng: areaMatch.lng };
          }
        }
      }
    } else if (stepNum === 6) {
      const parsed = step6Schema.parse(req.body);
      for (const doc of parsed.documents) {
        await storage.assertOwned(doc.fileUrl, {
          ownerRole: 'provider',
          ownerId: provider._id.toString(),
        });

        const masked = maskDocumentNumber(doc.type, doc.number);
        const enc = doc.number ? encryptDoc(doc.number) : undefined;

        await ProviderDocument.findOneAndUpdate(
          { providerId: provider._id, type: doc.type },
          {
            providerId: provider._id,
            type: doc.type,
            fileUrl: doc.fileUrl,
            numberMasked: masked || undefined,
            numberEnc: enc,
            expiryDate: doc.expiryDate,
            status: 'uploaded',
          },
          { upsert: true, new: true }
        );
      }

      // Check required documents
      const uploadedDocs = await ProviderDocument.find({ providerId: provider._id }).lean();
      const uploadedTypes = new Set(uploadedDocs.map((d) => d.type));
      const missingRequired = REQUIRED_DOC_TYPES.filter((t) => !uploadedTypes.has(t));

      if (missingRequired.length > 0) {
        throw new AppError(
          422,
          ERROR_CODES.PREVIOUS_STEP_INCOMPLETE,
          `Mandatory documents missing: ${missingRequired.join(', ')}`
        );
      }
    }

    if (!provider.completedSteps.includes(stepNum)) {
      provider.completedSteps.push(stepNum);
      provider.completedSteps.sort((a, b) => a - b);
    }

    const nextStep = Math.min(7, Math.max(provider.registrationStep, stepNum + 1));
    provider.registrationStep = nextStep;

    await provider.save();

    const responsePayload: Record<string, unknown> = {
      registrationStep: nextStep,
      saved: true,
    };

    if (stepNum === 2) {
      responsePayload.primaryCategory = provider.category;
      responsePayload.secondaryCategories = provider.secondaryCategories;
    }

    return respond.ok(req, res, responsePayload);
  },

  async getSummary(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const docs = await ProviderDocument.find({ providerId: provider._id }).lean();
    const docSummary: Record<string, boolean> = {
      aadhaar: false,
      pan: false,
      gst: false,
      tradeLicense: false,
      fssai: false,
    };
    for (const d of docs) {
      if (d.type === 'trade_license') docSummary.tradeLicense = true;
      else docSummary[d.type] = true;
    }

    const summary = {
      businessInfo: {
        businessName: provider.businessName,
        ownerName: provider.ownerName,
        mobile: provider.mobile,
        whatsapp: provider.whatsapp,
        email: provider.email,
        district: provider.district,
        description: provider.description,
        tagline: provider.tagline,
      },
      categories: {
        primary: provider.category,
        secondary: provider.secondaryCategories,
      },
      serviceDetails: {
        vegPreference: provider.vegPreference,
        cuisineTypes: provider.cuisineTypes,
        minCapacity: provider.minCapacity,
        maxCapacity: provider.maxCapacity,
        yearsActive: provider.yearsActive,
        ...(provider.serviceDetails || {}),
      },
      pricing: provider.pricing,
      coverage: provider.coverage,
      documents: docSummary,
      canSubmit: [1, 2, 3, 4, 5, 6].every((s) => provider.completedSteps.includes(s)),
    };

    return respond.ok(req, res, summary);
  },

  async submit(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    submitRegistrationSchema.parse(req.body);

    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    if (!['draft', 'rejected'].includes(provider.status)) {
      throw new AppError(
        409,
        ERROR_CODES.REGISTRATION_LOCKED,
        'Registration has already been submitted'
      );
    }

    const isComplete = [1, 2, 3, 4, 5, 6].every((s) => provider.completedSteps.includes(s));
    if (!isComplete) {
      throw new AppError(
        422,
        ERROR_CODES.PREVIOUS_STEP_INCOMPLETE,
        'All registration steps 1 through 6 must be completed before submission'
      );
    }

    provider.status = 'pending';
    provider.submittedAt = new Date();
    provider.termsAcceptedAt = new Date();
    provider.rejectionReason = undefined;

    await provider.save();

    return respond.ok(req, res, {
      status: 'pending',
      message: 'Application submitted for review. Verification takes 24-48 business hours.',
    });
  },
};
