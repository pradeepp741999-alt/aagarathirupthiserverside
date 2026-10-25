import { describe, it, expect } from 'vitest';
import {
  camelToSnakeString,
  snakeToCamelString,
  deepCamelToSnake,
  deepSnakeToCamel,
} from '@/common/utils/caseConvert';

describe('caseConvert Utilities', () => {
  it('converts camelCase string to snake_case string', () => {
    expect(camelToSnakeString('firstName')).toBe('first_name');
    expect(camelToSnakeString('advanceNoticeDays')).toBe('advance_notice_days');
    expect(camelToSnakeString('guestCount')).toBe('guest_count');
  });

  it('converts snake_case string to camelCase string', () => {
    expect(snakeToCamelString('first_name')).toBe('firstName');
    expect(snakeToCamelString('advance_notice_days')).toBe('advanceNoticeDays');
    expect(snakeToCamelString('guest_count')).toBe('guestCount');
  });

  it('preserves keys that start with digits like 5_star', () => {
    expect(camelToSnakeString('5_star')).toBe('5_star');
    expect(snakeToCamelString('5_star')).toBe('5_star');
    expect(camelToSnakeString('5Star')).toBe('5_star');
  });

  it('deeply converts object keys to snake_case without touching values', () => {
    const input = {
      providerName: 'Annapoorna',
      pricingDetails: {
        startingPrice: 15000,
        advancePercentage: 30,
        serviceAreas: ['Salem', 'Namakkal'],
      },
      ratingsMap: {
        '5_star': 120,
        '4_star': 15,
      },
    };

    const output = deepCamelToSnake(input) as any;
    expect(output.provider_name).toBe('Annapoorna');
    expect(output.pricing_details.starting_price).toBe(15000);
    expect(output.pricing_details.advance_percentage).toBe(30);
    expect(output.pricing_details.service_areas).toEqual(['Salem', 'Namakkal']);
    expect(output.ratings_map['5_star']).toBe(120);
  });

  it('deeply converts object keys to camelCase', () => {
    const input = {
      provider_name: 'Annapoorna',
      pricing_details: {
        starting_price: 15000,
        advance_percentage: 30,
      },
    };

    const output = deepSnakeToCamel(input) as any;
    expect(output.providerName).toBe('Annapoorna');
    expect(output.pricingDetails.startingPrice).toBe(15000);
    expect(output.pricingDetails.advancePercentage).toBe(30);
  });
});
