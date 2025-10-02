/*
 * Ingestion alert helper
 *
 * Sends webhook notifications when nightly ingestion fails or produces anomalies.
 */

const ALERT_WEBHOOK = process.env.INGESTION_ALERT_WEBHOOK;
const ALERT_CHANNEL = process.env.INGESTION_ALERT_CHANNEL ?? 'Ingestion Alerts';

interface AlertPayload {
  level: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  metadata?: Record<string, any>;
}

export async function sendIngestionAlert(alert: AlertPayload): Promise<void> {
  if (!ALERT_WEBHOOK) {
    return;
  }

  const timestamp = new Date().toISOString();
  const color = alert.level === 'error' ? '#ef4444' : alert.level === 'warning' ? '#f59e0b' : '#3b82f6';

  const body = {
    text: `[${ALERT_CHANNEL}] ${alert.title}`,
    attachments: [
      {
        color,
        title: alert.title,
        footer: ALERT_CHANNEL,
        ts: Math.floor(Date.now() / 1000),
        fields: [
          {
            title: 'Level',
            value: alert.level,
            short: true,
          },
          alert.message
            ? {
                title: 'Message',
                value: alert.message,
                short: false,
              }
            : null,
          alert.metadata
            ? {
                title: 'Details',
                value: '```' + JSON.stringify(alert.metadata, null, 2) + '```',
                short: false,
              }
            : null,
          {
            title: 'Timestamp',
            value: timestamp,
            short: false,
          },
        ].filter(Boolean),
      },
    ],
  };

  try {
    await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[IngestionAlert] Failed to send webhook', error);
  }
}

export async function sendIngestionFailure(clanTag: string, context: Record<string, any>) {
  await sendIngestionAlert({
    level: 'error',
    title: `Ingestion failed for ${clanTag}`,
    message: context.error?.message || context.error || 'Unknown error',
    metadata: context,
  });
}

export async function sendIngestionWarning(clanTag: string, message: string, metadata?: Record<string, any>) {
  await sendIngestionAlert({
    level: 'warning',
    title: `Ingestion warning for ${clanTag}`,
    message,
    metadata,
  });
}
