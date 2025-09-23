import cron from 'node-cron';
import { runIngestionJob } from './run-ingestion';

let scheduled = false;

export function ensureIngestionSchedule() {
  if (scheduled) return;
  if (process.env.NODE_ENV !== 'production') return;

  const cronExpr = process.env.INGESTION_CRON || '0 6 * * *';

  cron.schedule(cronExpr, async () => {
    try {
      await runIngestionJob();
    } catch (error) {
      console.error('[ingestion-schedule] failed', error);
    }
  }, {
    timezone: 'UTC',
  });

  scheduled = true;
}

