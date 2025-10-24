// web-next/src/lib/date-format.ts
// Helpers for parsing and formatting UTC snapshot timestamps consistently

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPACE_SEPARATED_RE = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?(?:\s*)$/;

/**
 * Attempt to parse a timestamp as a UTC Date.
 * Handles ISO strings, date-only strings, and space-separated timestamps.
 */
export function parseUtcDate(input?: string | null): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.valueOf())) {
    return direct;
  }

  let candidate = trimmed;
  if (DATE_ONLY_RE.test(trimmed)) {
    candidate = `${trimmed}T00:00:00Z`;
  } else if (SPACE_SEPARATED_RE.test(trimmed)) {
    const replaced = trimmed.replace(' ', 'T');
    if (/[+-]\d{2}:?\d{2}$/.test(replaced) || /[zZ]$/.test(replaced)) {
      candidate = replaced;
    } else {
      candidate = `${replaced}Z`;
    }
  } else if (!/[zZ]$/.test(trimmed) && !/[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    candidate = `${trimmed}Z`;
  }

  const date = new Date(candidate);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

export function formatUtcDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUtcDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
