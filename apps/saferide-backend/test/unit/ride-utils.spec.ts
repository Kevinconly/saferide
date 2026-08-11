import {
  computeFareCents,
  haversineKm,
  isInServiceArea,
} from '../../src/modules/rides/ride.utils';

describe('ride.utils', () => {
  describe('haversineKm', () => {
    it('returns 0 for identical points', () => {
      expect(
        haversineKm({ lat: -1.95, lng: 30.06 }, { lat: -1.95, lng: 30.06 }),
      ).toBeCloseTo(0, 6);
    });

    it('computes a reasonable distance across Kigali (~10 km downtown to Kicukiro)', () => {
      const d = haversineKm(
        { lat: -1.9536, lng: 30.0606 },
        { lat: -1.9878, lng: 30.1193 },
      );
      expect(d).toBeGreaterThan(6);
      expect(d).toBeLessThan(12);
    });
  });

  describe('isInServiceArea', () => {
    it('accepts Kigali coordinates', () => {
      expect(isInServiceArea({ lat: -1.95, lng: 30.06 })).toBe(true);
    });

    it('rejects coordinates far outside Kigali', () => {
      expect(isInServiceArea({ lat: -2.5, lng: 29.5 })).toBe(false);
      expect(isInServiceArea({ lat: 0.3, lng: 32.5 })).toBe(false);
    });
  });

  describe('computeFareCents', () => {
    it('returns base fare for zero distance', () => {
      expect(computeFareCents(0)).toBeGreaterThan(0);
    });

    it('scales linearly with distance', () => {
      const a = computeFareCents(1);
      const b = computeFareCents(2);
      expect(b - a).toBeCloseTo(a - computeFareCents(0), 0);
      expect(b).toBeGreaterThan(a);
    });
  });
});
