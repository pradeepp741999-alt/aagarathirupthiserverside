import dayjs from 'dayjs';
import { IEnquiry } from '@/models/Enquiry';
import { IProvider } from '@/models/Provider';
import {
  CANONICAL_TO_USER_STATUS,
  CANONICAL_TO_PROVIDER_STATUS,
} from './enquiries.statusMap';

export function toUserEnquiryDto(enquiry: any, provider?: any) {
  const userStatus = CANONICAL_TO_USER_STATUS[enquiry.status] || enquiry.status;

  const expectedResponseBy = dayjs(enquiry.createdAt)
    .add(provider?.avgResponseMinutes || 120, 'minute')
    .toISOString();

  return {
    id: enquiry._id.toString(),
    code: enquiry.code,
    providerId: enquiry.providerId?.toString() || enquiry.providerId,
    providerName: provider?.businessName || enquiry.providerSnapshot?.businessName || 'Service Provider',
    category: enquiry.category,
    createdAt: enquiry.createdAt instanceof Date ? enquiry.createdAt.toISOString() : enquiry.createdAt,
    eventType: enquiry.eventType,
    eventDate: enquiry.eventDate,
    eventEndDate: enquiry.eventEndDate || null,
    eventTime: enquiry.eventTime || null,
    mealType: enquiry.mealType || null,
    location: enquiry.location,
    district: enquiry.district,
    guestCount: enquiry.guestCount,
    makeupPersonsCount: enquiry.makeupPersonsCount || null,
    simultaneousStyling: enquiry.simultaneousStyling || false,
    backupArtistAssigned: enquiry.backupArtistAssigned || false,
    staffing: enquiry.staffing || null,
    items: (enquiry.items || []).map((it: any) => ({
      dishId: it.dishId ? it.dishId.toString() : null,
      packageId: it.packageId ? it.packageId.toString() : null,
      name: it.name,
      price: it.price,
      qty: it.qty,
    })),
    estimatedTotal: enquiry.estimatedTotal,
    budgetMin: enquiry.budgetMin || null,
    budgetMax: enquiry.budgetMax || null,
    notes: enquiry.notes || null,
    status: userStatus,
    providerQuote: enquiry.quote?.amount || null,
    providerMessage: enquiry.quote?.message || null,
    hasReview: !!enquiry.hasReview,
    reviewId: enquiry.reviewId ? enquiry.reviewId.toString() : null,
    bookingId: enquiry.bookingId ? enquiry.bookingId.toString() : null,
    quote: enquiry.quote
      ? {
          amount: enquiry.quote.amount,
          validUntil: enquiry.quote.validUntil || null,
          inclusions: enquiry.quote.inclusions || [],
          terms: enquiry.quote.terms || null,
          message: enquiry.quote.message || null,
          sentAt: enquiry.quote.sentAt ? new Date(enquiry.quote.sentAt).toISOString() : null,
        }
      : null,
    timeline: (enquiry.timeline || []).map((t: any) => ({
      kind: t.kind,
      status: t.status ? CANONICAL_TO_USER_STATUS[t.status] || t.status : null,
      author: t.author,
      message: t.message,
      at: t.at instanceof Date ? t.at.toISOString() : t.at,
    })),
    expectedResponseBy,
    rejectionReason: enquiry.rejectionReason || null,
    provider: provider
      ? {
          id: provider._id.toString(),
          name: provider.businessName,
          phone: provider.mobile,
          whatsapp: provider.whatsapp || provider.mobile,
          rating: provider.rating,
          reviewCount: provider.reviewCount,
          verified: provider.verified,
          coverImage: provider.coverImage || null,
        }
      : null,
  };
}

export function toProviderEnquiryListItemDto(enquiry: any) {
  const providerStatus = CANONICAL_TO_PROVIDER_STATUS[enquiry.status] || enquiry.status;

  return {
    id: enquiry._id.toString(),
    code: enquiry.code,
    customerName: enquiry.customer?.name || 'Customer',
    customerMobile: enquiry.customer?.mobile ? `+91 ${enquiry.customer.mobile}` : '',
    eventType: enquiry.eventType,
    eventDate: enquiry.eventDate,
    eventEndDate: enquiry.eventEndDate || null,
    mealType: enquiry.mealType || null,
    guestCount: enquiry.guestCount,
    estimatedTotal: enquiry.estimatedTotal,
    quoteAmount: enquiry.quote?.amount || null,
    status: providerStatus,
    isNewLead: !!enquiry.isNewLead,
    createdAt: enquiry.createdAt instanceof Date ? enquiry.createdAt.toISOString() : enquiry.createdAt,
  };
}

export function toProviderEnquiryDetailDto(enquiry: any) {
  const providerStatus = CANONICAL_TO_PROVIDER_STATUS[enquiry.status] || enquiry.status;

  return {
    id: enquiry._id.toString(),
    code: enquiry.code,
    customer: {
      name: enquiry.customer?.name || 'Customer',
      mobile: enquiry.customer?.mobile ? `+91 ${enquiry.customer.mobile}` : '',
      whatsapp: enquiry.customer?.whatsapp ? `+91 ${enquiry.customer.whatsapp}` : '',
      email: enquiry.customer?.email || null,
    },
    eventDetails: {
      type: enquiry.eventType,
      date: enquiry.eventDate,
      endDate: enquiry.eventEndDate || null,
      time: enquiry.eventTime || null,
      mealType: enquiry.mealType || null,
      location: enquiry.location,
      district: enquiry.district,
      guestCount: enquiry.guestCount,
      makeupPersonsCount: enquiry.makeupPersonsCount || null,
      simultaneousStyling: !!enquiry.simultaneousStyling,
      specialRequests: enquiry.notes || '',
    },
    staffing: enquiry.staffing || null,
    items: (enquiry.items || []).map((it: any) => ({
      id: (it.dishId || it.packageId || it._id || '').toString(),
      name: it.name,
      price: it.price,
      quantity: it.qty,
      total: it.price * it.qty,
    })),
    estimatedTotal: enquiry.estimatedTotal,
    quote: enquiry.quote
      ? {
          amount: enquiry.quote.amount,
          validUntil: enquiry.quote.validUntil || null,
          inclusions: enquiry.quote.inclusions || [],
          terms: enquiry.quote.terms || null,
          message: enquiry.quote.message || null,
          sentAt: enquiry.quote.sentAt ? new Date(enquiry.quote.sentAt).toISOString() : null,
        }
      : null,
    status: providerStatus,
    bookingId: enquiry.bookingId ? enquiry.bookingId.toString() : null,
    rejectionReason: enquiry.rejectionReason || null,
    timeline: (enquiry.timeline || []).map((t: any) => ({
      kind: t.kind,
      status: t.status ? CANONICAL_TO_PROVIDER_STATUS[t.status] || t.status : null,
      author: t.author,
      message: t.message,
      at: t.at instanceof Date ? t.at.toISOString() : t.at,
    })),
    createdAt: enquiry.createdAt instanceof Date ? enquiry.createdAt.toISOString() : enquiry.createdAt,
    updatedAt: enquiry.updatedAt instanceof Date ? enquiry.updatedAt.toISOString() : enquiry.updatedAt,
  };
}
