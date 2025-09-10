// web-next/src/lib/config.ts
export const cfg = {
  dataRoot: process.env.NODE_ENV === "production" ? "/tmp/data" : "../out",          // nightly outputs + tenure_ledger.jsonl
  fallbackDataRoot: process.env.NODE_ENV === "production" ? "/tmp/fallback" : "../data", // baseline inputs
  homeClanTag: "#2PR8R8V8P",
  enableCleanDownload: false
} as const;

