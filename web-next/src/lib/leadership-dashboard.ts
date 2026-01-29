const DEFAULT_WINDOW_LABEL = 'Last 7 days';
const SNAPSHOT_PENDING_LABEL = 'Snapshot pending';

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const formatUtcShortDate = (value: string) => {
  const parsed = new Date(value);
  if (!isValidDate(parsed)) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
};

export const formatLeadershipWindowLabel = (
  windowStart: string | null | undefined,
  windowEnd: string | null | undefined,
) => {
  if (!windowStart || !windowEnd) return DEFAULT_WINDOW_LABEL;
  const startLabel = formatUtcShortDate(windowStart);
  const endLabel = formatUtcShortDate(windowEnd);
  if (!startLabel || !endLabel) return DEFAULT_WINDOW_LABEL;
  return `${startLabel} - ${endLabel}`;
};

export const formatLeadershipSnapshotLabel = (snapshotFetchedAt: string | null | undefined) => {
  if (!snapshotFetchedAt) return SNAPSHOT_PENDING_LABEL;
  const parsed = new Date(snapshotFetchedAt);
  if (!isValidDate(parsed)) return SNAPSHOT_PENDING_LABEL;
  return `${parsed.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} UTC`;
};

export const leadershipDashboardLabels = {
  DEFAULT_WINDOW_LABEL,
  SNAPSHOT_PENDING_LABEL,
};
