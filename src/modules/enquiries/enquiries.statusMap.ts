import { CanonicalEnquiryStatus } from '@/config/constants';

export const CANONICAL_TO_USER_STATUS: Record<string, string> = {
  submitted: 'submitted',
  provider_reviewing: 'provider_reviewing',
  quote_sent: 'quote_sent',
  accepted: 'accepted',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled', // User sees cancelled (+ rejectionReason)
};

export const CANONICAL_TO_PROVIDER_STATUS: Record<string, string> = {
  submitted: 'pending',
  provider_reviewing: 'reviewing',
  quote_sent: 'quote_sent',
  accepted: 'accepted',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'rejected',
};

export const INPUT_STATUS_ALIAS_MAP: Record<string, CanonicalEnquiryStatus> = {
  submitted: 'submitted',
  pending: 'submitted',
  new: 'submitted',
  provider_reviewing: 'provider_reviewing',
  reviewing: 'provider_reviewing',
  quote_sent: 'quote_sent',
  responded: 'quote_sent',
  provider_responded: 'quote_sent',
  accepted: 'accepted',
  confirmed: 'accepted', // User sending confirmed normalizes to accepted (D7)
  customer_reviewing: 'accepted',
  confirmation_pending: 'accepted',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'rejected',
};

export function normalizeInputStatus(rawStatus: string): CanonicalEnquiryStatus | null {
  const clean = rawStatus.trim().toLowerCase();
  return INPUT_STATUS_ALIAS_MAP[clean] || null;
}
