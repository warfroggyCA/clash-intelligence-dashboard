#!/usr/bin/env node
/**
 * Heartbeat writer for the dev-status sidecar.
 * Writes to output/dev-heartbeat.json every N seconds.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_PATH = process.env.DEV_HEARTBEAT_PATH || path.resolve(process.cwd(), 'output', 'dev-heartbeat.json');
const INTERVAL_MS = Number(process.env.DEV_HEARTBEAT_INTERVAL_MS || 5000);
const NOTE = process.env.DEV_HEARTBEAT_NOTE || 'Working on /new/roster spec2 parity';

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });

async function write(status = 'working') {
  const payload = {
    atMs: Date.now(),
    status,
    note: NOTE,
    pid: process.pid,
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
}

await write('working');
setInterval(() => {
  write('working').catch(() => {
    // ignore
  });
}, INTERVAL_MS);

// Keep process alive
process.stdin.resume();
