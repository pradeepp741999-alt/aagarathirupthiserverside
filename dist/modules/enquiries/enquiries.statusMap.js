"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INPUT_STATUS_ALIAS_MAP = exports.CANONICAL_TO_PROVIDER_STATUS = exports.CANONICAL_TO_USER_STATUS = void 0;
exports.normalizeInputStatus = normalizeInputStatus;
exports.CANONICAL_TO_USER_STATUS = {
    submitted: 'submitted',
    provider_reviewing: 'provider_reviewing',
    quote_sent: 'quote_sent',
    accepted: 'accepted',
    confirmed: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'cancelled', // User sees cancelled (+ rejectionReason)
};
exports.CANONICAL_TO_PROVIDER_STATUS = {
    submitted: 'pending',
    provider_reviewing: 'reviewing',
    quote_sent: 'quote_sent',
    accepted: 'accepted',
    confirmed: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'rejected',
};
exports.INPUT_STATUS_ALIAS_MAP = {
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
function normalizeInputStatus(rawStatus) {
    const clean = rawStatus.trim().toLowerCase();
    return exports.INPUT_STATUS_ALIAS_MAP[clean] || null;
}
