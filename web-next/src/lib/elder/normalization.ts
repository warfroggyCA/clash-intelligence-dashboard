export interface DonationStats {
  median: number;
  iqr: number;
}

export function computeDonationStats(members: Array<{ donations?: number }>): DonationStats {
  const sorted = members
    .map((m) => typeof m.donations === 'number' ? m.donations : 0)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  if (!sorted.length) {
    return { median: 0, iqr: 1 };
  }

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? median;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? median;
  const iqr = Math.max(q3 - q1, 1);
  return { median, iqr };
}

export function normalizeDonations(value: number, stats: DonationStats): number {
  const z = (value - stats.median) / stats.iqr;
  const clamped = Math.max(-2, Math.min(2, z));
  return Math.round(((clamped + 2) / 4) * 100);
}
