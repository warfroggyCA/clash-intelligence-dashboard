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
  const [historyNote, setHistoryNote] = useState<string>('');
  const [historyLink, setHistoryLink] = useState<string | null>(null);
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
    setHistoryNote(''); setHistoryLink(null);
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

      // History / alias audit
      try {
        const a = json.data.applicant || {};
        const nm = String(a.name || '');
        const tg = String(a.tag || '');
        const effClan = (storeClan || clanTag || defaultClanTag || '').trim();

        const norm = (s: string) => String(s || '').replace('#', '').toUpperCase();

        // 1) Local history by tag or alias
        try {
          const mod = await import('@/lib/player-history-storage');
          const rec = mod.loadHistory(tg, nm);
          if (rec && (rec.status === 'departed' || rec.movements.some((m: any) => m.type === 'departed'))) {
            setHistoryNote('Applicant appears in your history with a prior departure');
            setHistoryLink(`/retired/${norm(tg)}`);
          } else {
            const byAlias = mod.findByAlias(nm);
            if (byAlias) {
              setHistoryNote(`Name matches previous alias for ${byAlias.primaryName}`);
              setHistoryLink(`/retired/${norm(byAlias.tag)}`);
            }
          }
        } catch {}

        // 2) Departures list on server
        if (!historyNote && effClan) {
          try {
            const res2 = await fetch(`/api/departures?clanTag=${encodeURIComponent(effClan)}`, { cache: 'no-store' });
            const j2 = await res2.json();
            if (res2.ok && j2?.success) {
              const items = Array.isArray(j2.data) ? j2.data : [];
              const hit = items.find((d: any) => norm(d.memberTag) === norm(tg))
                || items.find((d: any) => String(d.memberName || '').toLowerCase().trim() === nm.toLowerCase().trim());
              if (hit) {
                setHistoryNote('This tag/name appears in your departed list');
                setHistoryLink(`/retired/${norm(hit.memberTag)}`);
              }
            }
          } catch {}
        }
      } catch {}
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
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applicant Management</h1>
          <p className="text-gray-600">Evaluate individual players, build shortlists, and scan external clans for potential recruits</p>
        </div>

        {/* Evaluate Applicant Section */}
        <div className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <span className="text-emerald-600 font-bold">1</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Evaluate Individual Applicant</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player Tag
                <Info className="w-4 h-4 text-gray-400 inline ml-1" />
              </label>
              <input 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                placeholder="#XXXXXXXX" 
                value={tag} 
                onChange={e => setTag(e.target.value)} 
              />
              <p className="mt-2 text-sm text-gray-500">Clan context defaults to your current clan for fit scoring</p>
            </div>
            <div className="flex items-end">
              <button 
                onClick={onEvaluate} 
                disabled={loading || !tag.trim()} 
                className="w-full lg:w-auto inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors" 
                title="Fetch player data and compute evaluation"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Evaluating…
                  </>
                ) : (
                  'Evaluate Player'
                )}
              </button>
            </div>
          </div>
          {historyNote && (
            <div className="mt-3 rounded border bg-amber-50 p-3 text-amber-800 text-sm">
              <div className="font-semibold">History/Alias Audit</div>
              <div>{historyNote}</div>
              {historyLink && (
                <div className="mt-1">
                  <a href={historyLink} target="_blank" rel="noreferrer" className="underline text-amber-900 hover:text-amber-700">View retired profile</a>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}
          
          {result && (
            <div className="bg-gray-50 rounded-lg p-6">
              {/* Player Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {result.applicant?.name} 
                    <span className="text-gray-500 font-normal">({result.applicant?.tag})</span>
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>TH {result.applicant?.townHallLevel ?? '—'}</span>
                    <span>Trophies {result.applicant?.trophies ?? '—'}</span>
                    <span>Rush {result?.applicant ? computeRushPercent(result.applicant) : 0}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-gray-900">{result.evaluation.score}</div>
                  <div className={`text-lg font-semibold ${recColor(result.evaluation.recommendation)}`}>
                    {result.evaluation.recommendation}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)} 
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="shortlisted">Shortlisted</option>
                    <option value="consider-later">Consider Later</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <button 
                  onClick={onSaveToPlayerDB} 
                  disabled={saved} 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors" 
                  title="Save this evaluation as a note in Player Database"
                >
                  {saved ? '✓ Saved' : 'Save to Database'}
                </button>
                <button 
                  onClick={onCopyDiscord} 
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors" 
                  title="Copy a Discord-ready summary"
                >
                  {copied ? '✓ Copied!' : 'Copy Discord Summary'}
                </button>
                {saved && (
                  <span className="text-sm text-green-700 self-center bg-green-100 px-3 py-1 rounded-full">
                    ✓ Saved locally
                  </span>
                )}
              </div>

              {/* Evaluation Breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 divide-y">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">Evaluation Breakdown</h4>
                </div>
                {result.evaluation.breakdown.map((b, i) => (
                  <div key={i} className="flex items-start justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">{b.category}</div>
                      <div className="text-sm text-gray-600">{b.details}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{b.points} / {b.maxPoints}</div>
                      <div className="text-xs text-gray-500">
                        {Math.round((b.points / b.maxPoints) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shortlist Builder Section */}
        <div className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Shortlist Builder</h2>
          </div>
          
          <p className="text-gray-600 mb-6">Build a ranked shortlist from locally saved candidates (status: shortlisted/consider-later). Apply filters to refine results.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Filters */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Filters</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Top N</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={topN} 
                    onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min TH
                    <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={16} 
                    value={minTh} 
                    onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max TH
                    <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={16} 
                    value={maxTh} 
                    onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Score
                    <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={minScore} 
                    onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Trophies
                    <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    value={minTrophies} 
                    onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Rush %
                    <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={maxRush} 
                    onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
                <div className="flex flex-wrap gap-3">
                  {(['member','elder','coleader','leader'] as const).map(r => (
                    <label key={r} className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={!!roles[r]} 
                        onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Action Button */}
            <div className="flex items-end">
              <button 
                onClick={buildShortlist} 
                disabled={building} 
                className="w-full lg:w-auto inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {building ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Building…
                  </>
                ) : (
                  'Build Shortlist'
                )}
              </button>
            </div>
          </div>
          {shortlist.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">Shortlist Results ({shortlist.length} candidates)</h4>
              </div>
              {shortlist.map((item, idx) => (
                <div key={item.applicant.tag} className="p-4 flex items-start justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-gray-400">#{idx+1}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{item.applicant.name}</div>
                        <div className="text-sm text-gray-500">{item.applicant.tag}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Score: <span className="font-semibold">{item.evaluation.score}</span></span>
                      <span>Recommendation: <span className="font-semibold text-emerald-600">{item.evaluation.recommendation}</span></span>
                      <span>Rush: <span className="font-semibold">{computeRushPercent(item.applicant)}%</span></span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => { 
                      await navigator.clipboard.writeText(buildDiscordBlurbFor(item)); 
                      setCopied(true); 
                      setTimeout(()=>setCopied(false),1200); 
                    }} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                  >
                    {copied ? '✓ Copied!' : 'Copy Summary'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan External Clan Section */}
        <div className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold">3</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Scan External Clan</h2>
          </div>
          
          <p className="text-gray-600 mb-6">Fetch a clan roster by tag, score all members against your clan&apos;s profile, and return the top N. Apply the same filters.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Clan Tag Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                External Clan Tag
                <Info className="w-4 h-4 text-gray-400 inline ml-1" />
              </label>
              <input 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                placeholder="#XXXXXXXX" 
                value={scanTag} 
                onChange={e => setScanTag(e.target.value)} 
              />
            </div>
            
            {/* Action Button */}
            <div className="flex items-end">
              <button 
                onClick={scanExternalClan} 
                disabled={scanning || !scanTag.trim()} 
                className="w-full lg:w-auto inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {scanning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Scanning…
                  </>
                ) : (
                  'Scan & Shortlist'
                )}
              </button>
            </div>
          </div>
          
          {/* Reuse the same filters from shortlist builder */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-4">Filters (same as shortlist builder)</h3>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Top N</label>
                <input 
                  type="number" 
                  min={1} 
                  max={50} 
                  value={topN} 
                  onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min TH
                  <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={16} 
                  value={minTh} 
                  onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max TH
                  <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={16} 
                  value={maxTh} 
                  onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Score
                  <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={minScore} 
                  onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Trophies
                  <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  value={minTrophies} 
                  onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Rush %
                  <Info className="w-4 h-4 text-gray-400 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={maxRush} 
                  onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
              <div className="flex flex-wrap gap-3">
                {(['member','elder','coleader','leader'] as const).map(r => (
                  <label key={r} className="inline-flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={!!roles[r]} 
                      onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} 
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {scanResults.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Scan Results ({scanResults.length} candidates)</h4>
                <button 
                  onClick={async ()=>{ 
                    const text = scanResults.map(buildDiscordBlurbFor).map((t,i)=>`#${i+1} ${t}`).join('\n\n'); 
                    await navigator.clipboard.writeText(text); 
                    setCopied(true); 
                    setTimeout(()=>setCopied(false), 1200); 
                  }} 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                  {copied ? '✓ Copied All!' : 'Copy All Summaries'}
                </button>
              </div>
              {scanResults.map((item, idx) => (
                <div key={item.applicant.tag} className="p-4 flex items-start justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-gray-400">#{idx+1}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{item.applicant.name}</div>
                        <div className="text-sm text-gray-500">{item.applicant.tag}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Score: <span className="font-semibold">{item.evaluation.score}</span></span>
                      <span>Recommendation: <span className="font-semibold text-emerald-600">{item.evaluation.recommendation}</span></span>
                      <span>Rush: <span className="font-semibold">{computeRushPercent(item.applicant)}%</span></span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => { 
                      await navigator.clipboard.writeText(buildDiscordBlurbFor(item)); 
                      setCopied(true); 
                      setTimeout(()=>setCopied(false),1200); 
                    }} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                  >
                    {copied ? '✓ Copied!' : 'Copy Summary'}
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
