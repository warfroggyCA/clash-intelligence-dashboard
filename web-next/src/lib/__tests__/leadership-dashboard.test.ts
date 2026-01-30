import { formatLeadershipSnapshotLabel, formatLeadershipWindowLabel } from '@/lib/leadership-dashboard';

describe('leadership dashboard formatting helpers', () => {
  it('formats the leadership window label when both dates are valid', () => {
    const label = formatLeadershipWindowLabel('2026-01-02T05:00:00.000Z', '2026-01-09T05:00:00.000Z');
    expect(label).toBe('Jan 02 - Jan 09');
  });

  it('falls back to the default window label when dates are missing or invalid', () => {
    expect(formatLeadershipWindowLabel(null, null)).toBe('Last 7 days');
    expect(formatLeadershipWindowLabel('invalid', '2026-01-09T05:00:00.000Z')).toBe('Last 7 days');
  });

  it('formats snapshot timestamps as UTC', () => {
    const label = formatLeadershipSnapshotLabel('2026-01-02T05:04:00.000Z');
    expect(label).toBe('Jan 02, 05:04 UTC');
  });

  it('returns a pending label when snapshot timestamps are missing or invalid', () => {
    expect(formatLeadershipSnapshotLabel(null)).toBe('Snapshot pending');
    expect(formatLeadershipSnapshotLabel('invalid')).toBe('Snapshot pending');
  });
});
