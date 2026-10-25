import { describe, it, expect } from 'vitest';
import { haversineDistanceKm } from '@/common/utils/distance';
import {
  nowIST,
  todayIST,
  formatDisplayDate,
  formatDateRange,
  eachDay,
} from '@/common/utils/dates';

describe('Distance & Date Utilities', () => {
  it('calculates Haversine distance between two coordinates in kilometers', () => {
    // Salem (11.6643, 78.1460) to Namakkal (11.2189, 78.1674) is approx 49-50 km
    const dist = haversineDistanceKm(11.6643, 78.146, 11.2189, 78.1674);
    expect(dist).toBeGreaterThan(45);
    expect(dist).toBeLessThan(55);
  });

  it('handles zero distance for identical coordinates', () => {
    const dist = haversineDistanceKm(11.6643, 78.146, 11.6643, 78.146);
    expect(dist).toBe(0);
  });

  it('formats dates in Indian Standard Time (IST)', () => {
    const d = todayIST();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const formatted = formatDisplayDate('2026-11-15');
    expect(formatted).toBe('15 Nov 2026');

    const range = formatDateRange('2026-11-15', '2026-11-17');
    expect(range).toBe('15 Nov 2026 - 17 Nov 2026');
  });

  it('generates array of days between start and end date inclusive', () => {
    const days = eachDay('2026-11-01', '2026-11-03');
    expect(days).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});
