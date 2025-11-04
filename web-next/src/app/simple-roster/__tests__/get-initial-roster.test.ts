import { transformRosterApiResponse } from '../roster-transform';
import { getInitialRosterData, ROSTER_REVALIDATE_SECONDS } from '../get-initial-roster';

const sampleApiResponse = {
  success: true,
  data: {
    clan: {
      id: 'clan-123',
      tag: '#2PR8R8V8P',
      name: 'Sample Clan',
      logo_url: 'https://example.com/logo.png',
      created_at: '2025-10-01T00:00:00Z',
      updated_at: '2025-10-31T00:00:00Z',
    },
    snapshot: {
      id: 'snapshot-123',
      fetchedAt: '2025-10-31T12:00:00Z',
      memberCount: 1,
      metadata: {
        snapshotDate: '2025-10-31',
        fetchedAt: '2025-10-31T12:00:00Z',
        warLogEntries: 5,
        capitalSeasons: 2,
        version: 'data-spine',
        ingestionVersion: 'v1',
        schemaVersion: 'schema-1',
        computedAt: '2025-10-31T12:05:00Z',
        seasonId: '2025-10',
        seasonStart: '2025-10-01',
        seasonEnd: '2025-10-31',
      },
    },
    members: [
      {
        tag: '#PLAYER1',
        name: 'Player One',
        townHallLevel: 14,
        role: 'member',
        trophies: 3200,
        donations: 150,
        donationsReceived: 120,
        rankedLeagueId: 105000015,
        rankedLeagueName: 'Valkyrie League 15',
        rankedTrophies: 3400,
        lastWeekTrophies: 3350,
        seasonTotalTrophies: 6700,
        tenureDays: 42,
        tenureAsOf: '2025-10-31',
        bk: 75,
        aq: 75,
        gw: 50,
        rc: 20,
        mp: 10,
        activity: {
          score: 48,
          level: 'Active',
          indicators: ['Ranked battles', 'Donations'],
        },
      },
    ],
  },
} as const;

const sampleFetchResponse = {
  ok: true,
  json: async () => sampleApiResponse,
} as const;

describe('transformRosterApiResponse', () => {
  it('normalizes API payload into roster data shape', () => {
    const result = transformRosterApiResponse(sampleApiResponse);
    expect(result).toEqual(
      expect.objectContaining({
        clanName: 'Sample Clan',
        clanTag: '#2PR8R8V8P',
        members: [
          expect.objectContaining({
            tag: '#PLAYER1',
            name: 'Player One',
            townHallLevel: 14,
            rankedLeagueId: 105000015,
            rankedLeagueName: 'Valkyrie League 15',
            activity: expect.objectContaining({ score: 48 }),
          }),
        ],
        snapshotMetadata: expect.objectContaining({
          snapshotDate: '2025-10-31',
          fetchedAt: '2025-10-31T12:00:00Z',
          memberCount: 1,
        }),
      }),
    );
  });

  it('throws when API response is missing data', () => {
    expect(() => transformRosterApiResponse({ success: false })).toThrow('Invalid API response format');
  });
});

describe('getInitialRosterData', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (global.fetch as any) = jest.fn().mockResolvedValue(sampleFetchResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('fetches roster data with cache revalidation and tags', async () => {
    process.env.VERCEL_URL = 'demo.vercel.app';
    const result = await getInitialRosterData('#2PR8R8V8P');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe('https://demo.vercel.app/api/v2/roster?clanTag=%232PR8R8V8P');
    expect(options).toMatchObject({
      cache: 'force-cache',
      headers: expect.objectContaining({ Accept: 'application/json' }),
      next: {
        revalidate: ROSTER_REVALIDATE_SECONDS,
        tags: expect.arrayContaining(['roster', 'roster:#2PR8R8V8P']),
      },
    });
    expect(result.clanName).toBe('Sample Clan');
    expect(result.members).toHaveLength(1);
  });

  it('falls back to localhost base URL when no deployment host is set', async () => {
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    process.env.PORT = '9999';

    await getInitialRosterData('#2PR8R8V8P');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:5050/api/v2/roster?clanTag=%232PR8R8V8P');
  });

  it('throws when the roster API responds with an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    });

    await expect(getInitialRosterData('#2PR8R8V8P')).rejects.toThrow('Failed to load roster: 500');
  });
});

