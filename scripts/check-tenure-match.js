const fs = require('fs');
const path = require('path');

const clanTag = '#2PR8R8V8P';
const safe = clanTag.replace('#','').toLowerCase();
const outDir = path.join(process.cwd(), 'out');
const snapshotsDir = path.join(outDir, 'snapshots');
const ledgerPath = path.join(outDir, 'tenure_ledger.jsonl');

function normalizeTag(t){
  const s = String(t||'').trim().toUpperCase();
  return s.startsWith('#') ? s : '#'+s.replace(/^#+/,'');
}

function loadLatestSnapshotMembers(){
  try {
    const files = fs.readdirSync(snapshotsDir)
      .filter(f => f.startsWith(safe+'_') && f.endsWith('.json'))
      .sort();
    if (!files.length) return [];
    const latest = files[files.length-1];
    const snap = JSON.parse(fs.readFileSync(path.join(snapshotsDir, latest),'utf-8'));
    return (snap.members||[]).map(m => ({ tag: normalizeTag(m.tag), name: m.name }));
  } catch { return []; }
}

function loadLedgerMap(){
  const map = {};
  try {
    const lines = fs.readFileSync(ledgerPath,'utf-8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const latest = {}; const base = {}; const asof = {};
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        const tag = normalizeTag(row.tag);
        const ts = String(row.ts||'');
        if (!tag || !ts) continue;
        if (latest[tag] && latest[tag] >= ts) continue;
        latest[tag] = ts; base[tag] = Number(row.base||row.tenure_days||0)||0; asof[tag] = row.as_of||'';
      } catch {}
    }
    for (const [t,b] of Object.entries(base)) { map[t] = { base:b, as_of:asof[t] }; }
  } catch {}
  return map;
}

(function main(){
  const members = loadLatestSnapshotMembers();
  const ledger = loadLedgerMap();
  const tags = new Set(members.map(m=>m.tag));
  let hits = 0; let missing = [];
  for (const t of tags) {
    if (ledger[t]) hits++; else missing.push(t);
  }
  console.log(JSON.stringify({ members: members.length, ledgerRows: Object.keys(ledger).length, hits, missing: missing.slice(0,10) }, null, 2));
})();

