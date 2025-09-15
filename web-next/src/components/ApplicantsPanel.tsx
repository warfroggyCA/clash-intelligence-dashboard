"use client";

import React, { useState } from 'react';
import { computeRushPercent } from '@/lib/applicants';
import { Info } from 'lucide-react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

type EvalResult = {
  applicant: any;
  evaluation: { score: number; recommendation: string; breakdown: Array<{ category: string; points: number; maxPoints: number; details: string }>; };
  requestId?: string;
};

export default function ApplicantsPanel({ defaultClanTag }: { defaultClanTag: string }) {
  const { roster, clanTag: storeClan } = useDashboardStore();
  const [tag, setTag] = useState<string>('');
  const [clanTag, setClanTag] = useState<string>(storeClan || defaultClanTag || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('shortlisted');
  const [copied, setCopied] = useState<boolean>(false);
  const [shortlist, setShortlist] = useState<Array<{ applicant: any; evaluation: any }>>([]);
  const [building, setBuilding] = useState<boolean>(false);
  const [topN, setTopN] = useState<number>(10);
  const [scanTag, setScanTag] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResults, setScanResults] = useState<Array<{ applicant: any; evaluation: any }>>([]);
  // Filters
  const [minTh, setMinTh] = useState<number>(0);
  const [maxTh, setMaxTh] = useState<number>(0);
  const [minScore, setMinScore] = useState<number>(0);
  const [minTrophies, setMinTrophies] = useState<number>(0);
  const [maxRush, setMaxRush] = useState<number>(0);
  const [roles, setRoles] = useState<Record<string, boolean>>({ member: true, elder: true, coleader: false, leader: false });

  const onEvaluate = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const qs = new URLSearchParams();
      qs.set('tag', tag.trim());
      // Always include current or default clan for Clan Fit context if available
      const effectiveClan = (storeClan || clanTag || defaultClanTag || '').trim();
      if (effectiveClan) qs.set('clanTag', effectiveClan);
      const res = await fetch(`/api/applicants/evaluate?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Evaluation failed (${res.status})`);
      }
      setResult(json.data);
      setSaved(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to evaluate');
    } finally {
      setLoading(false);
    }
  };

  const onSaveToPlayerDB = () => {
    if (!result?.applicant || !result?.evaluation) return;
    try {
      const tagUpper = String(result.applicant.tag || '').toUpperCase();
      if (!tagUpper) throw new Error('Missing applicant tag');
      const notesKey = `player_notes_${tagUpper}`;
      const nameKey = `player_name_${tagUpper}`;
      const statusKey = `player_status_${tagUpper}`;
      const notes = JSON.parse(localStorage.getItem(notesKey) || '[]');
      const ts = new Date().toISOString();
      const d = new Date();
      const dateStr = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
      const a = result.applicant;
      const evaln = result.evaluation;
      const customFields: Record<string,string> = {
        'Score': `${evaln.score}`,
        'Recommendation': `${evaln.recommendation}`,
        'Applicant Status': status,
        'Town Hall': `${a.townHallLevel ?? ''}`,
        'Trophies': `${a.trophies ?? ''}`,
        'BK': `${a.bk ?? ''}`,
        'AQ': `${a.aq ?? ''}`,
        'GW': `${a.gw ?? ''}`,
        'RC': `${a.rc ?? ''}`,
        'MP': `${a.mp ?? ''}`,
        'Clan Context': clanTag || 'N/A',
      };
      const note = {
        timestamp: ts,
        note: `Applicant evaluation - ${dateStr}`,
        customFields,
      };
      notes.push(note);
      localStorage.setItem(notesKey, JSON.stringify(notes));
      if (a.name) localStorage.setItem(nameKey, a.name);
      if (status) localStorage.setItem(statusKey, status);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to save applicant');
    }
  };

  const buildDiscordBlurb = () => {
    if (!result?.applicant || !result?.evaluation) return '';
    const a = result.applicant;
    const e = result.evaluation;
    const th = a.townHallLevel ?? '—';
    const trophies = a.trophies ?? '—';
    const hero = (k: string, v: any) => (typeof v === 'number' ? `${k}${v}` : '');
    const heroStr = [hero('BK', a.bk), hero('AQ', a.aq), hero('GW', a.gw), hero('RC', a.rc)].filter(Boolean).join(' | ');
    const topTwo = [...e.breakdown].sort((x, y) => (y.points / y.maxPoints) - (x.points / x.maxPoints)).slice(0, 2).map(b => b.category).join(', ');
    const bottom = [...e.breakdown].sort((x, y) => (x.points / x.maxPoints) - (y.points / y.maxPoints)).slice(0, 1).map(b => `${b.category}: ${b.details}`).join('');
    const ctx = clanTag ? ` for ${clanTag}` : '';
    const rush = computeRushPercent(a);
    return `Applicant${ctx}: ${a.name} (${a.tag})\n` +
      `TH${th} • Trophies ${trophies}${heroStr ? ` • ${heroStr}` : ''}\n` +
      `Score: ${e.score} (${e.recommendation}) • Rush: ${rush}%\n` +
      `Strengths: ${topTwo || '—'}\n` +
      `Gap: ${bottom || '—'}\n` +
      `Status: ${status}`;
  };

  const onCopyDiscord = async () => {
    try {
      const text = buildDiscordBlurb();
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setError('Failed to copy to clipboard');
    }
  };

  const loadCandidateTagsFromLocal = (statuses = ['shortlisted','consider-later']) => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('player_notes_'));
      const tags = keys.map(k => k.replace('player_notes_', '').toUpperCase());
      return tags.filter(t => {
        const st = localStorage.getItem(`player_status_${t}`) || '';
        return statuses.length ? statuses.includes(st) : true;
      });
    } catch {
      return [] as string[];
    }
  };

  const buildShortlist = async () => {
    setBuilding(true); setError(''); setShortlist([]);
    try {
      const candidates = loadCandidateTagsFromLocal();
      if (!candidates.length) throw new Error('No local candidates with status shortlisted or consider-later');
      const effectiveClan = (storeClan || clanTag || defaultClanTag || '').trim();
      const res = await fetch('/api/applicants/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag: effectiveClan || undefined,
          tags: candidates,
          top: topN,
          minTh: minTh || undefined,
          maxTh: maxTh || undefined,
          minScore: minScore || undefined,
          minTrophies: minTrophies || undefined,
          includeRoles: Object.entries(roles).filter(([,v])=>v).map(([k])=>k),
          maxRush: maxRush || undefined,
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `Shortlist failed (${res.status})`);
      setShortlist(json.data.shortlist || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to build shortlist');
    } finally {
      setBuilding(false);
    }
  };

  const scanExternalClan = async () => {
    setScanning(true); setError(''); setScanResults([]);
    try {
      const effectiveContext = (storeClan || clanTag || defaultClanTag || '').trim();
      const qs = new URLSearchParams();
      qs.set('sourceClanTag', scanTag.trim());
      if (effectiveContext) qs.set('contextClanTag', effectiveContext);
      qs.set('top', String(topN));
      if (minTh) qs.set('minTh', String(minTh));
      if (maxTh) qs.set('maxTh', String(maxTh));
      if (minScore) qs.set('minScore', String(minScore));
      if (minTrophies) qs.set('minTrophies', String(minTrophies));
      const includeRoles = Object.entries(roles).filter(([,v])=>v).map(([k])=>k).join(',');
      if (includeRoles) qs.set('includeRoles', includeRoles);
      if (maxRush) qs.set('maxRush', String(maxRush));
      const res = await fetch(`/api/applicants/scan-clan?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `Scan failed (${res.status})`);
      setScanResults(json.data.shortlist || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to scan clan');
    } finally {
      setScanning(false);
    }
  };

  const recColor = (rec?: string) => rec === 'Excellent' ? 'text-emerald-700' : rec === 'Good' ? 'text-green-700' : rec === 'Fair' ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow">
        <h2 className="text-2xl font-semibold mb-4">Evaluate Applicant</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600 inline-flex items-center gap-1">Player Tag
              <Info className="w-3.5 h-3.5 text-gray-400" title="Enter a Clash player tag like #ABC123XYZ. We’ll score the player against your clan’s profile." />
            </label>
            <input className="mt-1 w-full border rounded px-3 py-2" placeholder="#XXXXXXXX" value={tag} onChange={e => setTag(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">Clan context defaults to your current clan for fit scoring.</p>
          </div>
          <div className="flex items-end">
            <button onClick={onEvaluate} disabled={loading || !tag.trim()} className="w-full md:w-auto inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50" title="Fetch player data and compute evaluation">
              {loading ? 'Evaluating…' : 'Evaluate'}
            </button>
          </div>
        </div>
        {error && <div className="text-rose-700 text-sm mb-2">{error}</div>}
        {result && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-medium">{result.applicant?.name} <span className="text-gray-500">({result.applicant?.tag})</span></div>
                <div className="text-sm text-gray-600">TH {result.applicant?.townHallLevel ?? '—'} • Trophies {result.applicant?.trophies ?? '—'} • Rush {result?.applicant ? computeRushPercent(result.applicant) : 0}%</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{result.evaluation.score}</div>
                <div className={`text-sm font-medium ${recColor(result.evaluation.recommendation)}`}>{result.evaluation.recommendation}</div>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 inline-flex items-center gap-1">Status
                  <Info className="w-3.5 h-3.5 text-gray-400" title="Set applicant status and save to Player DB (local)." />
                </label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value="shortlisted">Shortlisted</option>
                  <option value="consider-later">Consider Later</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <button onClick={onSaveToPlayerDB} disabled={saved} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" title="Save this evaluation as a note in Player Database (localStorage)">
                {saved ? 'Saved' : 'Save to Player DB'}
              </button>
              <button onClick={onCopyDiscord} className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" title="Copy a Discord-ready blurb with score, rush %, and highlights">
                {copied ? 'Copied!' : 'Copy Discord Blurb'}
              </button>
              {saved && <span className="text-sm text-green-700 self-center">Saved locally. View in Player Database tab.</span>}
            </div>
            <div className="divide-y rounded border">
              {result.evaluation.breakdown.map((b, i) => (
                <div key={i} className="flex items-start justify-between p-3">
                  <div>
                    <div className="font-medium">{b.category}</div>
                    <div className="text-xs text-gray-600">{b.details}</div>
                  </div>
                  <div className="text-sm text-gray-800">{b.points} / {b.maxPoints}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <h3 className="text-lg font-semibold mb-2">Shortlist Builder</h3>
          <p className="text-sm text-gray-600 mb-3">Build a ranked shortlist from locally saved candidates (status: shortlisted/consider-later). Apply filters to refine results.</p>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="text-sm text-gray-600">Top N</label>
              <input type="number" min={1} max={50} value={topN} onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} className="mt-1 w-24 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min TH
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates below this Town Hall" />
              </label>
              <input type="number" min={0} max={16} value={minTh} onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-20 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Max TH
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates above this Town Hall" />
              </label>
              <input type="number" min={0} max={16} value={maxTh} onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-20 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min Score
                <Info className="w-3.5 h-3.5 text-gray-400" title="Minimum evaluation score (0-100)" />
              </label>
              <input type="number" min={0} max={100} value={minScore} onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-24 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min Trophies
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates below this trophy count" />
              </label>
              <input type="number" min={0} value={minTrophies} onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-28 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Max Rush %
                <Info className="w-3.5 h-3.5 text-gray-400" title="Exclude players at or above this rush percentage (rush = average hero deficit vs TH caps)" />
              </label>
              <input type="number" min={0} max={100} value={maxRush} onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} className="mt-1 w-28 border rounded px-2 py-1" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Roles:</span>
              {(['member','elder','coleader','leader'] as const).map(r => (
                <label key={r} className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={!!roles[r]} onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>
            <button onClick={buildShortlist} disabled={building} className="inline-flex items-center px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
              {building ? 'Building…' : 'Build Shortlist'}
            </button>
          </div>
          {shortlist.length > 0 && (
            <div className="rounded border divide-y">
              {shortlist.map((item, idx) => (
                <div key={item.applicant.tag} className="p-3 flex items-start justify-between">
                  <div>
                    <div className="font-medium">#{idx+1} {item.applicant.name} <span className="text-gray-500">({item.applicant.tag})</span></div>
                    <div className="text-sm text-gray-600">Score {item.evaluation.score} • {item.evaluation.recommendation} • Rush {computeRushPercent(item.applicant)}%</div>
                  </div>
                  <button onClick={async () => { await navigator.clipboard.writeText(buildDiscordBlurbFor(item)); setCopied(true); setTimeout(()=>setCopied(false),1200); }} className="text-sm px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    {copied ? 'Copied!' : 'Copy Blurb'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold mb-2">Scan External Clan</h3>
          <p className="text-sm text-gray-600 mb-3">Fetch a clan roster by tag, score all members against your clan’s profile, and return the top N. Apply the same filters.</p>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">External Clan Tag
                <Info className="w-3.5 h-3.5 text-gray-400" title="Enter a clan tag to fetch its current roster and evaluate fits." />
              </label>
              <input className="mt-1 w-48 border rounded px-2 py-1" placeholder="#XXXXXXXX" value={scanTag} onChange={e => setScanTag(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Top N</label>
              <input type="number" min={1} max={50} value={topN} onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} className="mt-1 w-24 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min TH
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates below this Town Hall" />
              </label>
              <input type="number" min={0} max={16} value={minTh} onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-20 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Max TH
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates above this Town Hall" />
              </label>
              <input type="number" min={0} max={16} value={maxTh} onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-20 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min Score
                <Info className="w-3.5 h-3.5 text-gray-400" title="Minimum evaluation score (0-100)" />
              </label>
              <input type="number" min={0} max={100} value={minScore} onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-24 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Min Trophies
                <Info className="w-3.5 h-3.5 text-gray-400" title="Filter out candidates below this trophy count" />
              </label>
              <input type="number" min={0} value={minTrophies} onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} className="mt-1 w-28 border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-sm text-gray-600 inline-flex items-center gap-1">Max Rush %
                <Info className="w-3.5 h-3.5 text-gray-400" title="Exclude players at or above this rush percentage (rush = average hero deficit vs TH caps)" />
              </label>
              <input type="number" min={0} max={100} value={maxRush} onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} className="mt-1 w-28 border rounded px-2 py-1" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Roles:</span>
              {(['member','elder','coleader','leader'] as const).map(r => (
                <label key={r} className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={!!roles[r]} onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>
            <button onClick={scanExternalClan} disabled={scanning || !scanTag.trim()} className="inline-flex items-center px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
              {scanning ? 'Scanning…' : 'Scan & Shortlist'}
            </button>
            {scanResults.length > 0 && (
              <button onClick={async ()=>{ const text = scanResults.map(buildDiscordBlurbFor).map((t,i)=>`#${i+1} ${t}`).join('\n\n'); await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false), 1200); }} className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            )}
          </div>
          {scanResults.length > 0 && (
            <div className="rounded border divide-y">
              {scanResults.map((item, idx) => (
                <div key={item.applicant.tag} className="p-3 flex items-start justify-between">
                  <div>
                    <div className="font-medium">#{idx+1} {item.applicant.name} <span className="text-gray-500">({item.applicant.tag})</span></div>
                    <div className="text-sm text-gray-600">Score {item.evaluation.score} • {item.evaluation.recommendation} • Rush {computeRushPercent(item.applicant)}%</div>
                  </div>
                  <button onClick={async () => { await navigator.clipboard.writeText(buildDiscordBlurbFor(item)); setCopied(true); setTimeout(()=>setCopied(false),1200); }} className="text-sm px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    {copied ? 'Copied!' : 'Copy Blurb'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildDiscordBlurbFor(item: { applicant: any; evaluation: any }) {
  const a = item.applicant; const e = item.evaluation;
  const th = a.townHallLevel ?? '—'; const trophies = a.trophies ?? '—';
  const hero = (k: string, v: any) => (typeof v === 'number' ? `${k}${v}` : '');
  const heroStr = [hero('BK', a.bk), hero('AQ', a.aq), hero('GW', a.gw), hero('RC', a.rc)].filter(Boolean).join(' | ');
  const topTwo = [...e.breakdown].sort((x, y) => (y.points / y.maxPoints) - (x.points / x.maxPoints)).slice(0, 2).map((b:any) => b.category).join(', ');
  const bottom = [...e.breakdown].sort((x, y) => (x.points / x.maxPoints) - (y.points / y.maxPoints)).slice(0, 1).map((b:any) => `${b.category}: ${b.details}`).join('');
  const rush = computeRushPercent(a);
  return `${a.name} (${a.tag})\nTH${th} • Trophies ${trophies}${heroStr ? ` • ${heroStr}` : ''}\nScore: ${e.score} (${e.recommendation}) • Rush: ${rush}%\nStrengths: ${topTwo || '—'}\nGap: ${bottom || '—'}`;
}
