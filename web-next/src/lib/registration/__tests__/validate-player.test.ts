import { validatePlayerInClan } from '../validate-player';
import { getLatestRosterSnapshot, resolveRosterMembers } from '@/lib/roster-resolver';

jest.mock('@/lib/roster-resolver', () => ({
  getLatestRosterSnapshot: jest.fn(),
  resolveRosterMembers: jest.fn(),
}));

const mockedGetLatestRosterSnapshot = getLatestRosterSnapshot as jest.Mock;
const mockedResolveRosterMembers = resolveRosterMembers as jest.Mock;

describe('validatePlayerInClan', () => {
  const baseSnapshot = {
    clanId: 'clan_1',
    clanTag: '#CLAN',
    snapshotId: 'snap_1',
    fetchedAt: new Date().toISOString(),
    snapshotDate: new Date().toISOString().slice(0, 10),
  };

  beforeEach(() => {
    mockedGetLatestRosterSnapshot.mockReset();
    mockedResolveRosterMembers.mockReset();
  });

  it('returns ok when snapshot matches clan', async () => {
    mockedGetLatestRosterSnapshot.mockResolvedValue(baseSnapshot);
    mockedResolveRosterMembers.mockResolvedValue({
      members: [{ tag: '#PLAYER', name: 'Tester' }],
      memberTagToId: new Map(),
      memberIdToTag: new Map(),
    });

    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase: {} as any });
    expect(result.ok).toBe(true);
    expect(result.playerName).toBe('Tester');
  });

  it('fails when player belongs to different clan (not found in roster)', async () => {
    mockedGetLatestRosterSnapshot.mockResolvedValue(baseSnapshot);
    mockedResolveRosterMembers.mockResolvedValue({
      members: [{ tag: '#OTHER', name: 'Other' }],
      memberTagToId: new Map(),
      memberIdToTag: new Map(),
    });

    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase: {} as any });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not found in clan roster|not currently in this clan|player not found/i);
  });

  it('fails when snapshot is older than lookback window', async () => {
    const oldFetchedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockedGetLatestRosterSnapshot.mockResolvedValue({ ...baseSnapshot, fetchedAt: oldFetchedAt });
    mockedResolveRosterMembers.mockResolvedValue({
      members: [{ tag: '#PLAYER', name: 'Tester' }],
      memberTagToId: new Map(),
      memberIdToTag: new Map(),
    });

    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase: {} as any, lookbackDays: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not appeared in roster snapshots recently/i);
  });

  it('returns failure when roster lookup throws', async () => {
    mockedGetLatestRosterSnapshot.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await validatePlayerInClan('#PLAYER', '#CLAN', { supabase: {} as any });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Roster lookup failed');
  });
});
