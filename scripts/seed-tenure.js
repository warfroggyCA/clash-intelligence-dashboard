// Seed tenure entries for current home clan using snapshots
const fs = require('fs');
const path = require('path');

const CLAN_TAG = '#2PR8R8V8P';
const outDir = path.join(process.cwd(), 'out');
const snapshotsDir = path.join(outDir, 'snapshots');
const ledgerPath = path.join(outDir, 'tenure_ledger.jsonl');

function ymdToday() {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return u.toISOString().slice(0, 10);
}
function daysSinceToDate(start, target) {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start||'');
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target||'');
  if (!m1 || !m2) return 0;
  const a = Date.UTC(+m1[1], +m1[2]-1, +m1[3]);
  const b = Date.UTC(+m2[1], +m2[2]-1, +m2[3]);
  const diff = Math.floor((b-a)/86400000);
  return diff > 0 ? diff : 0;
}

function normalizeTag(t) {
  const s = String(t||'').trim().toUpperCase();
  return s.startsWith('#') ? s : ('#'+s.replace(/^#+/, ''));
}

function listSnapshotDates() {
  const safe = CLAN_TAG.replace('#','').toLowerCase();
  try {
    return fs.readdirSync(snapshotsDir)
      .filter(f => f.startsWith(safe+'_') && f.endsWith('.json'))
      .map(f => f.substring(safe.length+1, f.length-5))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch { return []; }
}

(async function main(){
  const today = ymdToday();
  const safe = CLAN_TAG.replace('#','').toLowerCase();

  // Load current members from latest snapshot if available
  let memberTags = [];
  try {
    const files = fs.readdirSync(snapshotsDir)
      .filter(f => f.startsWith(safe+'_') && f.endsWith('.json'))
      .sort();
    if (files.length) {
      const latest = files[files.length-1];
      const snap = JSON.parse(fs.readFileSync(path.join(snapshotsDir, latest), 'utf-8'));
      memberTags = (snap.members || []).map(m => normalizeTag(m.tag));
    }
  } catch {}

  if (memberTags.length === 0) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'members.json'),'utf-8'));
      memberTags = arr.map(m => normalizeTag(m.tag));
    } catch {}
  }

  if (memberTags.length === 0) {
    console.log(JSON.stringify({ ok:false, error:"No members found in snapshots or data" }));
    return;
  }

  // Existing ledger tags
  const existing = new Set();
  try {
    const txt = fs.readFileSync(ledgerPath, 'utf-8');
    const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (const line of lines) {
      try { const row = JSON.parse(line); if (row && row.tag) existing.add(normalizeTag(row.tag)); } catch {}
    }
  } catch {}

  const dates = listSnapshotDates();
  const earliestClanDate = dates[0];
  const firstSeen = {};
  const need = new Set(memberTags.filter(t => !existing.has(t)));
  for (const d of dates) {
    if (need.size === 0) break;
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(snapshotsDir, `${safe}_${d}.json`), 'utf-8'));
      const present = new Set((snap.members||[]).map(m => normalizeTag(m.tag)));
      for (const t of Array.from(need)) {
        if (present.has(t)) { firstSeen[t] = d; need.delete(t); }
      }
    } catch {}
  }

  const toAppend = [];
  for (const tag of memberTags) {
    if (existing.has(tag)) continue;
    let base = 1;
    if (firstSeen[tag]) base = daysSinceToDate(firstSeen[tag], today);
    else if (earliestClanDate) base = daysSinceToDate(earliestClanDate, today);
    const row = { tag, base: Math.max(0, Math.round(base)), as_of: today, ts: new Date().toISOString() };
    toAppend.push(JSON.stringify(row));
  }

  if (toAppend.length === 0) {
    console.log(JSON.stringify({ ok:true, message:"No missing entries to seed", seeded:0 }));
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.appendFileSync(ledgerPath, toAppend.join('\n') + '\n', 'utf-8');
  console.log(JSON.stringify({ ok:true, seeded: toAppend.length, ledger: ledgerPath }));
})();

