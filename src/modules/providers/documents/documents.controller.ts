import { Request, Response } from 'express';
import { Provider } from '@/models/Provider';
import { ProviderDocument } from '@/models/ProviderDocument';
import { storage } from '@/services/storage';
import { encryptDoc } from '@/common/utils/crypto';
import { maskDocumentNumber } from '@/common/utils/mask';
import { todayIST } from '@/common/utils/dates';
import { REQUIRED_DOC_TYPES, DocumentType } from '@/config/constants';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

const DOC_TITLES: Record<string, string> = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  gst: 'GST Registration Certificate',
  trade_license: 'Trade / Business License',
  fssai: 'FSSAI Food Safety Certificate',
};

function validateDocumentNumberFormat(type: string, num?: string, expiryDate?: string) {
  if (!num) return;
  const clean = num.trim();

  if (type === 'aadhaar' && !/^\d{12}$/.test(clean)) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Aadhaar must be a 12-digit number');
  }
  if (type === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean.toUpperCase())) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'PAN must be 10 characters (e.g. ABCDE1234F)');
  }
  if (
    type === 'gst' &&
    !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean.toUpperCase())
  ) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Invalid GST number format');
  }
  if (type === 'fssai') {
    if (!/^\d{14}$/.test(clean)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'FSSAI must be a 14-digit license number');
    }
    if (!expiryDate || expiryDate <= todayIST()) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'FSSAI requires a future expiry date');
    }
  }
}

export const documentsController = {
  async getDocuments(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const isCatering =
      provider.category === 'catering' ||
      (provider.secondaryCategories || []).includes('catering');

    const applicableTypes: DocumentType[] = ['aadhaar', 'pan', 'gst', 'trade_license'];
    if (isCatering) {
      applicableTypes.push('fssai');
    }

    const docs = await ProviderDocument.find({ providerId: provider._id }).lean();
    const docMap = new Map<string, any>();
    for (const d of docs) {
      docMap.set(d.type, d);
    }

    const today = todayIST();

    const result = applicableTypes.map((type) => {
      const doc = docMap.get(type);
      let status = 'missing';

      if (doc) {
        if (doc.expiryDate && doc.expiryDate < today) {
          status = 'expired';
        } else {
          status = doc.status;
        }
      }

      return {
        type,
        title: DOC_TITLES[type] || type,
        status,
        number: doc?.numberMasked || null,
        fileUrl: doc?.fileUrl || null,
        expiryDate: doc?.expiryDate || null,
        rejectionReason: doc?.rejectionReason || null,
        isRequired: REQUIRED_DOC_TYPES.includes(type as any),
      };
    });

    return respond.ok(req, res, result);
  },

  async updateDocument(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const docType = req.params.type as DocumentType;
    const { number, expiryDate, fileUrl } = req.body;

    if (!fileUrl) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'file_url is required');
    }

    await storage.assertOwned(fileUrl, {
      ownerRole: 'provider',
      ownerId: providerId,
    });

    validateDocumentNumberFormat(docType, number, expiryDate);

    const masked = maskDocumentNumber(docType, number);
    const enc = number ? encryptDoc(number.trim()) : undefined;

    await ProviderDocument.findOneAndUpdate(
      { providerId, type: docType },
      {
        providerId,
        type: docType,
        fileUrl,
        numberMasked: masked || undefined,
        numberEnc: enc,
        expiryDate,
        status: 'uploaded',
        rejectionReason: undefined,
      },
      { upsert: true, new: true }
    );

    return respond.ok(req, res, undefined, {
      message: 'Document uploaded and submitted for reverification.',
    });
  },
};
