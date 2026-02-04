#!/usr/bin/env node
/**
 * Sidecar dev status server (independent of Next).
 *
 * - Serves human-readable status page: http://127.0.0.1:5051/
 * - Serves machine JSON:             http://127.0.0.1:5051/status.json
 *
 * This stays up even if Next dev (5050) gets SIGKILL'd.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec as execCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

function spawnDetached(cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
}

const PORT = Number(process.env.DEV_STATUS_PORT || 5051);
const NEXT_PORT = Number(process.env.NEXT_DEV_PORT || 5050);
const HEARTBEAT_PATH = process.env.DEV_HEARTBEAT_PATH
  || path.resolve(process.cwd(), 'output', 'dev-heartbeat.json');

async function readHeartbeat() {
  try {
    const raw = await fs.readFile(HEARTBEAT_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      ok: true,
      atMs: typeof data?.atMs === 'number' ? data.atMs : null,
      status: typeof data?.status === 'string' ? data.status : null,
      note: typeof data?.note === 'string' ? data.note : null,
      pid: typeof data?.pid === 'number' ? data.pid : null,
    };
  } catch {
    return { ok: false, atMs: null, status: null, note: null, pid: null };
  }
}

function checkNextDev() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: NEXT_PORT,
        path: '/api/health',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        // Any HTTP response means the port is up.
        res.resume();
        resolve({ up: true, statusCode: res.statusCode || null });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
      resolve({ up: false, statusCode: null });
    });

    req.on('error', () => {
      resolve({ up: false, statusCode: null });
    });

    req.end();
  });
}

function ageLabel(ms) {
  if (ms == null) return 'unknown';
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function htmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPage(payload) {
  const { nowMs, next, heartbeat, derived } = payload;
  const last = heartbeat.atMs;
  const ageMs = last ? nowMs - last : null;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dev Status</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #0b1220; color: rgba(255,255,255,0.92); }
    .wrap { max-width: 980px; margin: 0 auto; padding: 20px; }
    .card { border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; background: rgba(18,31,56,0.75); padding: 16px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .pill { display: inline-flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.25); }
    .dot { width: 10px; height: 10px; border-radius: 999px; }
    .big { font-size: 28px; font-weight: 900; letter-spacing: 0.02em; }
    .muted { color: rgba(255,255,255,0.65); }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 12px; }
    @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }

    /* animated "working" */
    @keyframes pulse { 0% { transform: scale(1); opacity: 0.65; } 50% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 0.65; } }
    .pulse { animation: pulse 1.1s ease-in-out infinite; }

    /* offline shake */
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-1px); } 75% { transform: translateX(1px); } }
    .shake { animation: shake 0.5s ease-in-out infinite; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="muted" style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 11px;">Dev Status (sidecar)</div>
          <div class="big">${htmlEscape(derived.label)}</div>
          <div class="muted">Last heartbeat: <span id="hbAge">${htmlEscape(derived.heartbeatAge)}</span> ago <span id="hbAt" class="muted">(at ${heartbeat.atMs ? new Date(heartbeat.atMs).toLocaleTimeString() : '—'})</span></div>
        </div>
        <div class="pill">
          <div class="dot ${derived.animClass}" style="background: ${derived.color}; box-shadow: 0 0 18px ${derived.color};"></div>
          <div>
            <div style="font-weight: 800;">${htmlEscape(derived.short)}</div>
            <div class="muted" style="font-size: 12px;">auto-refreshing</div>
          </div>
        </div>
      </div>

      <div style="height: 12px;"></div>

      <div class="grid">
        <div class="card" style="background: rgba(11,18,32,0.55);">
          <div class="muted" style="font-size: 12px;">Next dev</div>
          <div style="font-size: 18px; font-weight: 800;">${next.up ? 'UP' : 'DOWN'}</div>
          <div class="muted" style="font-size: 12px;">http://127.0.0.1:${NEXT_PORT} (status ${next.statusCode ?? 'n/a'})</div>
        </div>

        <div class="card" style="background: rgba(11,18,32,0.55);">
          <div class="muted" style="font-size: 12px;">Heartbeat file</div>
          <div style="font-size: 18px; font-weight: 800;">${heartbeat.ok ? 'OK' : 'MISSING'}</div>
          <div class="muted" style="font-size: 12px;">${htmlEscape(HEARTBEAT_PATH)}</div>
        </div>

        <div class="card" style="background: rgba(11,18,32,0.55);">
          <div class="muted" style="font-size: 12px;">What I’m doing</div>
          <div style="font-size: 14px; font-weight: 700;">${htmlEscape(heartbeat.note ?? '—')}</div>
          <div class="muted" style="font-size: 12px;">status=${htmlEscape(heartbeat.status ?? '—')}</div>
        </div>
      </div>

      <div style="height: 12px;"></div>

      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="muted" style="font-size: 12px;">
          This page polls <code>/status.json</code> every 1s.
          If it shows <b>OFFLINE</b>, Next dev is down. If it shows <b>STALE</b>, the agent heartbeat stopped.
        </div>
        <button id="restartBtn" class="pill" style="cursor: pointer; user-select: none;">
          <span class="dot pulse" style="background: rgba(251,191,36,0.95); box-shadow: 0 0 18px rgba(251,191,36,0.35);"></span>
          <span style="font-weight: 900;">Restart dev + wake agent</span>
        </button>
      </div>
    </div>
  </div>

<script>
  async function restart() {
    const btn = document.getElementById('restartBtn');
    if (!btn) return;
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
    try {
      await fetch('/restart', { method: 'POST' });
    } catch {}
    // Give it a moment, then reload.
    setTimeout(() => location.reload(), 900);
  }

  document.getElementById('restartBtn')?.addEventListener('click', restart);

  function fmtAge(ms) {
    if (ms == null) return 'unknown';
    if (ms < 1000) return ms + ' ms';
    if (ms < 60000) return Math.round(ms/1000) + 's';
    return Math.round(ms/60000) + 'm';
  }

  async function tick() {
    try {
      const res = await fetch('/status.json', { cache: 'no-store' });
      const data = await res.json();

      const nowMs = data?.nowMs;
      const atMs = data?.heartbeat?.atMs;
      const derived = data?.derived;

      // Update label + dot
      if (derived?.label) {
        const big = document.querySelector('.big');
        if (big) big.textContent = derived.label;
      }
      if (derived?.short) {
        const short = document.querySelector('.pill div > div');
        if (short) short.textContent = derived.short;
      }
      const dot = document.querySelector('.pill .dot');
      if (dot && derived?.color) {
        dot.style.background = derived.color;
        dot.style.boxShadow = '0 0 18px ' + derived.color;
        dot.className = 'dot ' + (derived.animClass || '');
      }

      // Update heartbeat age text (counts up)
      const ageEl = document.getElementById('hbAge');
      if (ageEl && typeof nowMs === 'number' && typeof atMs === 'number') {
        ageEl.textContent = fmtAge(nowMs - atMs);
      } else if (ageEl && derived?.heartbeatAge) {
        ageEl.textContent = derived.heartbeatAge;
      }

      const atEl = document.getElementById('hbAt');
      if (atEl && typeof atMs === 'number') {
        const t = new Date(atMs).toLocaleTimeString();
        atEl.textContent = '(at ' + t + ')';
      }
    } catch {
      // ignore
    }
  }
  tick();
  setInterval(tick, 1000);
</script>
</body>
</html>`;
}

async function restartAll() {
  // Best-effort: kill known processes, then restart Next + heartbeat.
  // This endpoint is local-only (127.0.0.1) and meant for dev convenience.
  try { await exec(`pkill -f "next dev -p ${NEXT_PORT}" || true`); } catch {}
  try { await exec(`pkill -f "scripts/agent-heartbeat.mjs" || true`); } catch {}

  // Touch a wake request file (future hook for OpenClaw wake).
  try {
    const wakePath = path.resolve(process.cwd(), 'output', 'wake.request.json');
    await fs.mkdir(path.dirname(wakePath), { recursive: true });
    await fs.writeFile(wakePath, JSON.stringify({ atMs: Date.now(), kind: 'wake' }, null, 2));
  } catch {}

  // Restart heartbeat writer.
  spawnDetached(process.execPath, ['scripts/agent-heartbeat.mjs'], process.cwd());

  // Restart Next dev (single-run; if it dies again, press button again or run your watchdog).
  spawnDetached('npm', ['run', 'dev'], process.cwd());
}

async function buildPayload() {
  const nowMs = Date.now();
  const [heartbeat, next] = await Promise.all([readHeartbeat(), checkNextDev()]);

  const ageMs = heartbeat.atMs ? nowMs - heartbeat.atMs : null;
  const fresh = ageMs != null && ageMs < 12_000;

  let label = 'PAUSED';
  let short = 'PAUSED';
  let color = 'rgba(251,191,36,0.9)';
  let animClass = 'pulse';

  if (!next.up) {
    label = 'OFFLINE (dev server down)';
    short = 'OFFLINE';
    color = 'rgba(248,113,113,0.95)';
    animClass = 'shake';
  } else if (!heartbeat.ok) {
    label = 'UNKNOWN (no heartbeat)';
    short = 'UNKNOWN';
    color = 'rgba(148,163,184,0.9)';
    animClass = 'pulse';
  } else if (!fresh) {
    label = 'STALE (agent not updating)';
    short = 'STALE';
    color = 'rgba(251,191,36,0.9)';
    animClass = 'pulse';
  } else {
    label = heartbeat.status === 'working' ? 'WORKING' : 'IDLE';
    short = heartbeat.status === 'working' ? 'WORKING' : 'IDLE';
    color = heartbeat.status === 'working' ? 'rgba(34,211,238,0.95)' : 'rgba(148,163,184,0.9)';
    animClass = heartbeat.status === 'working' ? 'pulse' : '';
  }

  return {
    nowMs,
    next,
    heartbeat,
    derived: {
      label,
      short,
      color,
      animClass,
      heartbeatAge: ageLabel(ageMs),
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (url.pathname === '/restart') {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: false, error: 'POST required' }));
        return;
      }

      // Fire-and-forget restart.
      restartAll().catch(() => {});

      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === '/status.json') {
      const payload = await buildPayload();
      const body = JSON.stringify(payload);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/dev-status') {
      const payload = await buildPayload();
      const body = renderPage(payload);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-status] listening on http://127.0.0.1:${PORT} (next:${NEXT_PORT}) heartbeat:${HEARTBEAT_PATH}`);
});
