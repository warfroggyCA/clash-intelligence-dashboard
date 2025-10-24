import cron from 'node-cron';
import { runIngestionJob } from './run-ingestion';

let scheduled = false;

export function ensureIngestionSchedule() {
  if (scheduled) return;
  if (process.env.NODE_ENV !== 'production') return;

  const cronExprs = process.env.INGESTION_CRON
    ? process.env.INGESTION_CRON.split(',').map((expr) => expr.trim()).filter(Boolean)
    : ['45 4 * * *', '15 5 * * *']; // 04:45 UTC and 05:15 UTC

  for (const cronExpr of cronExprs) {
    cron.schedule(cronExpr, async () => {
      try {
        await runIngestionJob();
      } catch (error) {
        console.error('[ingestion-schedule] failed', { cronExpr, error });
      }
    }, {
      timezone: 'UTC',
    });
  }

  scheduled = true;
}
