// web-next/src/lib/data-source-policy.ts
// Pure helper to decide roster fetch order and URLs

export type RosterFetchPlan = {
  urls: string[];
  sourcePreference: 'snapshot' | 'live';
};

export function buildRosterFetchPlan(clanTag: string, selectedSnapshot?: string): RosterFetchPlan {
  const base = `/api/roster?clanTag=${encodeURIComponent(clanTag)}`;
  const wantsSnapshot = !!selectedSnapshot && selectedSnapshot !== 'live';
  const date = selectedSnapshot === 'latest' || !selectedSnapshot ? 'latest' : selectedSnapshot;

  if (wantsSnapshot) {
    const snapshotUrl = `${base}&mode=snapshot&date=${encodeURIComponent(date)}`;
    return { urls: [snapshotUrl, base], sourcePreference: 'snapshot' };
  }
  return { urls: [base], sourcePreference: 'live' };
}

