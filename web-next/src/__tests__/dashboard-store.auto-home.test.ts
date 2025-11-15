import { useDashboardStore } from '@/lib/stores/dashboard-store';

const defaultSessionResponse = {
  success: true,
  data: {
    user: { id: 'user-1', email: 'doug.findlay@gmail.com' },
    roles: [
      {
        clan_tag: '#2PR8R8V8P',
        role: 'leader',
      },
    ],
  },
};

describe('dashboard-store home clan auto hydration', () => {
  const originalLoadRoster = useDashboardStore.getState().loadRoster;

  beforeEach(() => {
    useDashboardStore.getState().resetDashboard();
    useDashboardStore.setState({
      loadRoster: originalLoadRoster,
      hasAutoLoadedHomeClan: false,
      sessionStatus: 'idle',
    } as Partial<ReturnType<typeof useDashboardStore.getState>>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useDashboardStore.setState({
      loadRoster: originalLoadRoster,
      hasAutoLoadedHomeClan: false,
      sessionStatus: 'idle',
    } as Partial<ReturnType<typeof useDashboardStore.getState>>);
  });

  it('loads the saved home clan from Supabase after session hydrate', async () => {
    const loadRosterMock = jest.fn().mockResolvedValue(undefined);
    useDashboardStore.setState({
      loadRoster: loadRosterMock,
      clanTag: '',
      homeClan: '#2PR8R8V8P',
      roster: null,
      hasAutoLoadedHomeClan: false,
      sessionStatus: 'idle',
    } as Partial<ReturnType<typeof useDashboardStore.getState>>);

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => defaultSessionResponse,
    } as unknown as Response);

    await useDashboardStore.getState().hydrateSession();

    expect(fetchSpy).toHaveBeenCalledWith('/api/session', expect.any(Object));
    expect(loadRosterMock).toHaveBeenCalledWith('#2PR8R8V8P', expect.objectContaining({ force: false }));
  });

  it('retries when the home clan changes after the first load', async () => {
    const loadRosterMock = jest.fn().mockResolvedValue(undefined);
    useDashboardStore.setState({
      loadRoster: loadRosterMock,
      hasAutoLoadedHomeClan: true,
      sessionStatus: 'ready',
      clanTag: '#2PR8R8V8P',
      homeClan: '#2PR8R8V8P',
    } as Partial<ReturnType<typeof useDashboardStore.getState>>);

    useDashboardStore.getState().setHomeClan('#ABC12345');

    expect(loadRosterMock).toHaveBeenCalledWith('#ABC12345', expect.objectContaining({ force: false }));
  });
});

