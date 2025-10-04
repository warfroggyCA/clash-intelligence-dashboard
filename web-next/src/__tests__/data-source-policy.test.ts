import { buildRosterFetchPlan } from '../lib/data-source-policy';

describe('buildRosterFetchPlan', () => {
  test('live only when selectedSnapshot=live', () => {
    const p = buildRosterFetchPlan('#TAG', 'live');
    expect(p.sourcePreference).toBe('live');
    expect(p.urls.length).toBe(1);
    expect(p.urls[0]).not.toContain('mode=snapshot');
  });

  test('snapshot latest then live fallback', () => {
    const p = buildRosterFetchPlan('#TAG', 'latest');
    expect(p.sourcePreference).toBe('snapshot');
    expect(p.urls[0]).toContain('mode=snapshot');
    expect(p.urls[1]).toContain('/api/v2/roster?');
  });

  test('snapshot specific date then live fallback', () => {
    const p = buildRosterFetchPlan('#TAG', '2025-09-14');
    expect(p.urls[0]).toContain('date=2025-09-14');
  });
});
