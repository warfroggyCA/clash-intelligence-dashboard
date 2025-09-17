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

type DateLike = string | number | Date | null | undefined;

function normalizeDate(value: DateLike): Date | null {
  if (value == null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

interface SafeLocaleArgs {
  locales?: string | string[];
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
  context?: string;
}

function logInvalidDate(context: string | undefined, raw: DateLike, error?: unknown) {
  console.error(
    context ? `Invalid date for ${context}` : 'Invalid date value',
    raw,
    error instanceof Error ? error : undefined
  );
}

export function safeLocaleDateString(value: DateLike, args: SafeLocaleArgs = {}): string {
  const { locales, options, fallback = 'Unknown Date', context } = args;
  try {
    if (value == null || value === '') {
      return fallback;
    }
    const date = normalizeDate(value);
    if (!date) {
      logInvalidDate(context, value);
      return fallback;
    }
    return date.toLocaleDateString(locales, options);
  } catch (error) {
    logInvalidDate(context, value, error);
    return fallback;
  }
}

export function safeLocaleString(value: DateLike, args: SafeLocaleArgs = {}): string {
  const { locales, options, fallback = 'Unknown', context } = args;
  try {
    if (value == null || value === '') {
      return fallback;
    }
    const date = normalizeDate(value);
    if (!date) {
      logInvalidDate(context, value);
      return fallback;
    }
    return date.toLocaleString(locales, options);
  } catch (error) {
    logInvalidDate(context, value, error);
    return fallback;
  }
}

export function safeLocaleTimeString(value: DateLike, args: SafeLocaleArgs = {}): string {
  const { locales, options, fallback = 'Unknown', context } = args;
  try {
    if (value == null || value === '') {
      return fallback;
    }
    const date = normalizeDate(value);
    if (!date) {
      logInvalidDate(context, value);
      return fallback;
    }
    return date.toLocaleTimeString(locales, options);
  } catch (error) {
    logInvalidDate(context, value, error);
    return fallback;
  }
}
