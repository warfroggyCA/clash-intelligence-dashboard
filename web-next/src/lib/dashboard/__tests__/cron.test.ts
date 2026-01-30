import { getNextCronAt } from '../cron';

describe('getNextCronAt', () => {
  it('returns the 04:30 UTC slot when current time is before it', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 3, 0, 0));
    const next = getNextCronAt(now);
    expect(next.toISOString()).toBe(new Date(Date.UTC(2026, 0, 15, 4, 30, 0)).toISOString());
  });

  it('returns the 05:30 UTC slot when current time is between the slots', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 4, 45, 0));
    const next = getNextCronAt(now);
    expect(next.toISOString()).toBe(new Date(Date.UTC(2026, 0, 15, 5, 30, 0)).toISOString());
  });

  it('returns the next day 04:30 UTC slot when current time is after 05:30 UTC', () => {
    const now = new Date(Date.UTC(2026, 0, 15, 6, 10, 0));
    const next = getNextCronAt(now);
    expect(next.toISOString()).toBe(new Date(Date.UTC(2026, 0, 16, 4, 30, 0)).toISOString());
  });
});
