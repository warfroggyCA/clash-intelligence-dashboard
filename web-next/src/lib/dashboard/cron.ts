const CRON_HOURS = [
  { hour: 4, minute: 30 },
  { hour: 5, minute: 30 },
];

export function getNextCronAt(now: Date = new Date()): Date {
  const base = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  ));

  for (const slot of CRON_HOURS) {
    const candidate = new Date(Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      slot.hour,
      slot.minute,
      0,
      0,
    ));
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  const nextDay = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + 1,
    CRON_HOURS[0].hour,
    CRON_HOURS[0].minute,
    0,
    0,
  ));

  return nextDay;
}
