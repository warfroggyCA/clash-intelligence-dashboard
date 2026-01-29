export type TenureSource = {
  tenureDays?: number | null;
  tenureAsOf?: string | null;
};

export const resolveEffectiveTenureDays = (player: TenureSource, now: Date = new Date()) => {
  const baseDays = typeof player.tenureDays === 'number' ? player.tenureDays : null;
  if (baseDays == null) return null;
  if (!player.tenureAsOf) return baseDays;
  const asOfDate = new Date(player.tenureAsOf);
  if (Number.isNaN(asOfDate.getTime())) return baseDays;
  const delta = Math.floor((now.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24));
  if (delta <= 0) return baseDays;
  return baseDays + delta;
};
