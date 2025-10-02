// web-next/src/lib/data-source-policy.ts
// Pure helper to decide roster fetch order and URLs

export type RosterFetchPlan = {
  urls: string[];
  sourcePreference: 'snapshot' | 'live';
};

export function buildRosterFetchPlan(clanTag: string, selectedSnapshot?: string): RosterFetchPlan {
  const base = `/api/v2/roster?clanTag=${encodeURIComponent(clanTag)}`;
  
  // If explicitly requesting live data, return live-only plan
  if (selectedSnapshot === 'live') {
    return { urls: [base], sourcePreference: 'live' };
  }
  
  // Otherwise, prefer snapshot data with live fallback
  const date = selectedSnapshot === 'latest' || !selectedSnapshot ? 'latest' : selectedSnapshot;
  const snapshotUrl = `${base}&mode=snapshot&date=${encodeURIComponent(date)}`;
  return { urls: [snapshotUrl, base], sourcePreference: 'snapshot' };
}

