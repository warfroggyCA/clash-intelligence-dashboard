type Level = 'info' | 'warn' | 'error' | 'debug';

// Pluggable transport: if a provider is attached (e.g., pino) use it; else JSON to console
function emit(level: Level, payload: Record<string, any>) {
  const provider = (globalThis as any).__structuredLogger;
  if (provider && typeof provider[level] === 'function') {
    try { provider[level](payload); return; } catch {}
  }
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
}

export function createRequestLogger(req: Request, context: Partial<{ route: string; ip: string; requestId: string }> = {}) {
  const url = new URL(req.url);
  const ip = context.ip || (req as any).ip || (req.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const requestId = context.requestId || Math.random().toString(36).slice(2, 10);
  const base = { path: url.pathname, ip, requestId, route: context.route || url.pathname, ts: new Date().toISOString() };

  const log = (level: Level, msg: string, extra?: Record<string, any>) => {
    emit(level, { level, msg, ...base, ...(extra || {}) });
  };

  return {
    info: (msg: string, extra?: Record<string, any>) => log('info', msg, extra),
    warn: (msg: string, extra?: Record<string, any>) => log('warn', msg, extra),
    error: (msg: string, extra?: Record<string, any>) => log('error', msg, extra),
    debug: (msg: string, extra?: Record<string, any>) => log('debug', msg, extra),
    requestId,
  };
}
