import { resolveEffectiveTenureDays } from '@/lib/player-database/tenure';

describe('resolveEffectiveTenureDays', () => {
  const baseNow = new Date('2026-01-25T00:00:00Z');

  it('returns null when tenureDays is missing', () => {
    expect(resolveEffectiveTenureDays({ tenureDays: null }, baseNow)).toBeNull();
  });

  it('returns base when tenureAsOf is missing', () => {
    expect(resolveEffectiveTenureDays({ tenureDays: 10 }, baseNow)).toBe(10);
  });

  it('adds day delta when tenureAsOf is in the past', () => {
    expect(
      resolveEffectiveTenureDays(
        { tenureDays: 5, tenureAsOf: '2026-01-20T00:00:00Z' },
        baseNow,
      ),
    ).toBe(10);
  });

  it('does not subtract when asOf is in the future', () => {
    expect(
      resolveEffectiveTenureDays(
        { tenureDays: 5, tenureAsOf: '2026-02-01T00:00:00Z' },
        baseNow,
      ),
    ).toBe(5);
  });
});
