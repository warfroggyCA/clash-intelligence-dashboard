type Level = 'info' | 'warn' | 'error' | 'debug';

export function createRequestLogger(req: Request, context: Partial<{ route: string; ip: string; requestId: string }> = {}) {
  const url = new URL(req.url);
  const ip = context.ip || (req as any).ip || (req.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const requestId = context.requestId || Math.random().toString(36).slice(2, 10);
  const base = { path: url.pathname, ip, requestId, route: context.route || url.pathname };

  const log = (level: Level, msg: string, extra?: Record<string, any>) => {
    const payload = { level, ...base, msg, ...(extra || {}) };
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
  };

  return {
    info: (msg: string, extra?: Record<string, any>) => log('info', msg, extra),
    warn: (msg: string, extra?: Record<string, any>) => log('warn', msg, extra),
    error: (msg: string, extra?: Record<string, any>) => log('error', msg, extra),
    debug: (msg: string, extra?: Record<string, any>) => log('debug', msg, extra),
    requestId,
  };
}

