import { validatePlayerInClan } from '../validate-player';

type MaybeSingleResult = { data: any; error: any };

type QueryBuilder = {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  order: () => QueryBuilder;
  limit: () => QueryBuilder;
  maybeSingle: () => Promise<MaybeSingleResult>;
};

function buildSupabaseStub(row: any, error: any = null) {
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error }),
  };

  return {
    from: () => builder,
  } as any;
}

describe('validatePlayerInClan', () => {
  const baseRow = {
    player_tag: '#PLAYER',
    clan_tag: '#CLAN',
    snapshot_date: new Date().toISOString(),
    payload: { member: { name: 'Tester' } },
  };

  it('returns ok when snapshot matches clan', async () => {
    const supabase = buildSupabaseStub(baseRow);
    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase });
    expect(result.ok).toBe(true);
    expect(result.playerName).toBe('Tester');
  });

  it('fails when player belongs to different clan', async () => {
    const supabase = buildSupabaseStub({ ...baseRow, clan_tag: '#OTHER' });
    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not currently in this clan/i);
  });

  it('fails when snapshot is older than lookback window', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = buildSupabaseStub({ ...baseRow, snapshot_date: oldDate });
    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase, lookbackDays: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not appeared in roster snapshots recently/i);
  });

  it('returns failure when Supabase errors', async () => {
    const supabase = buildSupabaseStub(null, { message: 'boom' });
    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Roster lookup failed');
  });
});
