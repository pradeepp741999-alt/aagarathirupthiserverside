import { describe, it, expect } from 'vitest';
import { encryptDocumentNumber, decryptDocumentNumber } from '@/common/utils/crypto';
import { maskDocumentNumber, maskMobile } from '@/common/utils/mask';

describe('Crypto & Masking Utilities', () => {
  it('encrypts and decrypts document numbers with AES-256-GCM', () => {
    const rawAadhaar = '123456789012';
    const encrypted = encryptDocumentNumber(rawAadhaar);
    expect(encrypted).not.toBe(rawAadhaar);
    expect(encrypted.length).toBeGreaterThan(20);

    const decrypted = decryptDocumentNumber(encrypted);
    expect(decrypted).toBe(rawAadhaar);
  });

  it('masks document numbers appropriately per doc type', () => {
    // Aadhaar: last 4 visible
    expect(maskDocumentNumber('aadhaar', '123456789012')).toBe('XXXX-XXXX-9012');

    // PAN: digits and last char visible
    expect(maskDocumentNumber('pan', 'ABCDE1234F')).toBe('XXXXX1234F');

    // GST: first 2 and last 3 visible
    expect(maskDocumentNumber('gst', '33ABCDE1234F1Z5')).toBe('33XXXXX1234F1Z5');

    // FSSAI: last 4 visible
    expect(maskDocumentNumber('fssai', '12345678901234')).toBe('XXXXXXXXXX1234');
  });

  it('masks mobile phone numbers showing only last 4 digits', () => {
    expect(maskMobile('9876543210')).toBe('XXXXXX3210');
  });
});
