import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService(null as never);
  });

  describe('calculatePrice', () => {
    it.each([
      { distanceKm: 0.5, expected: '500.00' },
      { distanceKm: 1, expected: '500.00' },
      { distanceKm: 2, expected: '900.00' },
      { distanceKm: 5, expected: '2100.00' },
      { distanceKm: 10, expected: '4100.00' },
    ])('calculates $distanceKm km as $expected', ({ distanceKm, expected }) => {
      expect(service.calculatePrice(distanceKm, 500, 400)).toBe(expected);
    });
  });
});
