import { normalizeTag } from '@/lib/tags';
import type { ElderMetricInputs } from './types';

interface CsvRow {
  name: string;
  playerTag: string;
  tenure_days: string;
  consistency: string;
  generosity: string;
  performance: string;
  role?: string;
  is_elder?: string;
  prev_score?: string;
}

export function parseCsvLine(line: string): CsvRow | null {
  const parts = line.split(',').map((p) => p.trim());
  if (parts.length < 6) return null;

  const [name, playerTag, tenureDays, consistency, generosity, performance] = parts;
  let role: string | undefined;
  let isElder: string | undefined;
  let prevScore: string | undefined;

  if (parts.length >= 9) {
    role = parts[6];
    isElder = parts[7];
    prevScore = parts[8];
  } else {
    role = undefined;
    isElder = parts[6];
    prevScore = parts[7];
  }

  return {
    name,
    playerTag,
    tenure_days: tenureDays,
    consistency,
    generosity,
    performance,
    role,
    is_elder: isElder,
    prev_score: prevScore,
  } satisfies CsvRow;
}

export function csvRowToMetric(row: CsvRow): ElderMetricInputs {
  return {
    name: row.name,
    playerTag: normalizeTag(row.playerTag),
    tenureDays: Number.parseInt(row.tenure_days, 10) || 0,
    role: row.role,
    consistency: Number.parseFloat(row.consistency) || 0,
    generosity: Number.parseFloat(row.generosity) || 0,
    performance: Number.parseFloat(row.performance) || 0,
    isElder: row.is_elder ? row.is_elder.toLowerCase() === 'true' : undefined,
    previousScore: row.prev_score ? Number.parseFloat(row.prev_score) : null,
  } satisfies ElderMetricInputs;
}

export function parseCsv(content: string): ElderMetricInputs[] {
  const lines = content.split(/\r?\n/);
  const metrics: ElderMetricInputs[] = [];
  for (const line of lines) {
    if (!line.trim() || line.trim().toLowerCase().startsWith('name,')) continue;
    const row = parseCsvLine(line);
    if (!row) continue;
    metrics.push(csvRowToMetric(row));
  }
  return metrics;
}
