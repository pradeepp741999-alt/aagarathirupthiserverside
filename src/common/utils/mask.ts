import { DocumentType } from '@/config/constants';

export function maskAadhaar(aadhaar: string): string {
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function maskPAN(pan: string): string {
  const clean = pan.trim().toUpperCase();
  if (clean.length < 5) return 'XXXXX0000X';
  const digits = clean.slice(5, 9);
  const last = clean.slice(9, 10);
  return `XXXXX${digits}${last}`;
}

export function maskGST(gst: string): string {
  const clean = gst.trim().toUpperCase();
  if (clean.length < 15) return 'XXXXXXXXXXXXXXX';
  const state = clean.slice(0, 2);
  const panMasked = maskPAN(clean.slice(2, 12));
  const entity = clean.slice(12);
  return `${state}${panMasked}${entity}`;
}

export function maskMobile(mobile: string): string {
  const clean = mobile.replace(/\D/g, '').slice(-10);
  if (clean.length < 10) return clean;
  return `XXXXXX${clean.slice(6)}`;
}

export function maskDocumentNumber(type: DocumentType, num?: string | null): string | null {
  if (!num) return null;
  const clean = num.trim();
  switch (type) {
    case 'aadhaar':
      return maskAadhaar(clean);
    case 'pan':
      return maskPAN(clean);
    case 'gst':
      return maskGST(clean);
    case 'fssai':
      return clean.length >= 4 ? `XXXXXXXXXX${clean.slice(-4)}` : 'XXXXXXXXXXXXXX';
    case 'trade_license':
      return clean.length >= 4 ? `XXXX-${clean.slice(-4)}` : 'XXXX-XXXX';
    default:
      return clean.length >= 4 ? `XXXX-${clean.slice(-4)}` : 'XXXX';
  }
}
