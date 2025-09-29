import { useDashboardStore } from '@/lib/stores/dashboard-store';

const unsub = useDashboardStore.subscribe(
  (state) => state,
  (state, prev) => {
    const changedKeys = Object.keys(state).filter((key) => (state as any)[key] !== (prev as any)[key]);
    console.log('State updated; changed keys:', changedKeys.slice(0, 10));
  }
);

const roster = {
  clanTag: '#TEST',
  clanName: 'Test Clan',
  members: [],
  snapshotMetadata: {
    snapshotDate: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    memberCount: 0,
    warLogEntries: 0,
    capitalSeasons: 0,
    version: '1.0'
  },
  snapshotDetails: null
};

console.log('Setting roster...');
useDashboardStore.getState().setRoster(roster as any);

setTimeout(() => {
  console.log('Final roster tag:', useDashboardStore.getState().roster?.clanTag);
  unsub();
}, 1000);
