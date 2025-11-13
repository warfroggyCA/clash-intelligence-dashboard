type Level = 'info' | 'warn' | 'error' | 'debug';

// Generate UUID - works in both Node.js and browser environments
function generateUUID(): string {
  // Try crypto.randomUUID() first (available in Node.js 14.17+ and modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments - UUID v4 format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  // Safely parse URL - handle both full URLs and relative paths
  let pathname = '/unknown';
  try {
    // req.url is always a string in Next.js Request objects
    const urlString = req.url || '';
    // Try parsing as full URL first
    try {
      const url = new URL(urlString);
      pathname = url.pathname;
    } catch {
      // If that fails, try with base URL
      const url = new URL(urlString, 'http://localhost');
      pathname = url.pathname;
    }
  } catch (e) {
    // Final fallback - extract pathname manually
    const urlString = String(req.url || '');
    const pathMatch = urlString.match(/^[^?]*/);
    pathname = pathMatch ? pathMatch[0] : '/unknown';
  }
  
  const ip = context.ip || (req as any).ip || (req.headers as any).get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  // Use generateUUID() for better uniqueness in tracing (works in both Node.js and browser)
  const requestId = context.requestId || generateUUID();
  const base = { path: pathname, ip, requestId, route: context.route || pathname, ts: new Date().toISOString() };

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
