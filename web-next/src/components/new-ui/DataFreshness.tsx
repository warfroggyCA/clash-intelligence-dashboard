import { formatDistanceToNow } from 'date-fns';
import { Clock } from 'lucide-react';

type Props = {
  /** ISO string or Date */
  at: string | Date | null | undefined;
  /** Label prefix, e.g. "Snapshot" or "Live" */
  modeLabel?: string;
  className?: string;
  /** If provided, rendered on a second line. */
  subline?: string;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatUtcExact(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' UTC';
}

export default function DataFreshness({ at, modeLabel = 'Data as of', className = '', subline }: Props) {
  const date = toDate(at);
  if (!date) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-500 ${className}`.trim()}>
        <Clock className="w-3.5 h-3.5" />
        <span>No data timestamp available</span>
      </div>
    );
  }

  const relative = formatDistanceToNow(date, { addSuffix: true });
  const exact = formatUtcExact(date);

  return (
    <div className={`space-y-1 text-xs ${className}`.trim()}>
      <div className="flex items-center gap-2 text-slate-300" title={exact}>
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>
          {modeLabel} {relative}
        </span>
      </div>
      {subline ? <div className="text-slate-500">{subline}</div> : null}
    </div>
  );
}
