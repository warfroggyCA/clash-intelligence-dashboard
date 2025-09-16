// web-next/src/lib/data-source-policy.ts
// Pure helper to decide roster fetch order and URLs

export type RosterFetchPlan = {
  urls: string[];
  sourcePreference: 'snapshot' | 'live';
};

export function buildRosterFetchPlan(clanTag: string, selectedSnapshot?: string): RosterFetchPlan {
  const base = `/api/roster?clanTag=${encodeURIComponent(clanTag)}`;
  // Always prefer snapshot data for roster - live data is only for ad-hoc queries
  const date = selectedSnapshot === 'latest' || !selectedSnapshot ? 'latest' : selectedSnapshot;
  const snapshotUrl = `${base}&mode=snapshot&date=${encodeURIComponent(date)}`;
  return { urls: [snapshotUrl, base], sourcePreference: 'snapshot' };
}

