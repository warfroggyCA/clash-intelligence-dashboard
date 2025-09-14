// web-next/src/lib/date.ts

// Returns today's date in UTC as YYYY-MM-DD
export function ymdNowUTC(): string {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return u.toISOString().slice(0, 10);
}

// Days between YYYY-MM-DD and today (UTC), min 0
export function daysSince(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return 0;
  const a = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.floor((b - a) / 86400000);
  return diff > 0 ? diff : 0;
}

// Days between start (YYYY-MM-DD) and target (YYYY-MM-DD), min 0
export function daysSinceToDate(start: string, targetDate: string): number {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || "");
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate || "");
  if (!m1 || !m2) return 0;
  const a = Date.UTC(+m1[1], +m1[2] - 1, +m1[3]);
  const b = Date.UTC(+m2[1], +m2[2] - 1, +m2[3]);
  const diff = Math.floor((b - a) / 86400000);
  return diff > 0 ? diff : 0;
}

