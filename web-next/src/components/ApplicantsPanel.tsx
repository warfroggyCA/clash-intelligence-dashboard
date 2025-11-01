"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { computeRushPercent } from '@/lib/applicants';
import { Info } from 'lucide-react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';
import { getPlayerHistoryRecord, getPlayerHistoryForClan, upsertPlayerHistory } from '@/lib/player-history-service';
import { syncLocalHistoryToSupabase } from '@/lib/player-history-sync';

type EvalResult = {
  applicant: any;
  evaluation: { score: number; recommendation: string; breakdown: Array<{ category: string; points: number; maxPoints: number; details: string }>; };
  requestId?: string;
};

type StoredApplicant = {
  id: string;
  clan_tag: string;
  player_tag: string;
  player_name: string | null;
  status: string;
  score: number | null;
  recommendation: string | null;
  rush_percent: number | null;
  evaluation: Record<string, any>;
  applicant: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export default function ApplicantsPanel({ defaultClanTag }: { defaultClanTag: string }) {
  const { roster, clanTag: storeClan } = useDashboardStore();
  const [tag, setTag] = useState<string>('');
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
  const [applicants, setApplicants] = useState<StoredApplicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [historySynced, setHistorySynced] = useState(false);

  const resolvedClanTag = useMemo(() => normalizeTag(storeClan || defaultClanTag || '') || null, [storeClan, defaultClanTag]);

  const loadApplicants = useCallback(async () => {
    if (!resolvedClanTag) {
      setApplicants([]);
      return [];
    }
    setLoadingApplicants(true);
    try {
      const res = await fetch(`/api/applicants/records?clanTag=${encodeURIComponent(resolvedClanTag)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load applicant records (${res.status})`);
      }
      const rows: StoredApplicant[] = Array.isArray(json.data) ? json.data : [];
      setApplicants(rows);
      return rows;
    } catch (err) {
      console.error('Failed to load applicants', err);
      return [];
    } finally {
      setLoadingApplicants(false);
    }
  }, [resolvedClanTag]);

  useEffect(() => {
    void loadApplicants();
  }, [loadApplicants]);

  useEffect(() => {
    if (!resolvedClanTag || historySynced) return;
    setHistorySynced(true);
    void syncLocalHistoryToSupabase(resolvedClanTag).catch((err) => {
      console.warn('[ApplicantsPanel] Failed to sync local player history', err);
    });
  }, [resolvedClanTag, historySynced]);

  const onEvaluate = async () => {
    setLoading(true); setError(''); setResult(null);
    setHistoryNote(''); setHistoryLink(null);
    try {
      const qs = new URLSearchParams();
      qs.set('tag', tag.trim());
      // Always include current or default clan for Clan Fit context if available
      const effectiveClan = resolvedClanTag || (storeClan || defaultClanTag || '').trim();
      if (effectiveClan) qs.set('clanTag', effectiveClan);
      const res = await fetch(`/api/applicants/evaluate?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Evaluation failed (${res.status})`);
      }
      setResult(json.data);
      setSaved(false);

      // History / alias audit via Supabase
      try {
        const applicant = json.data.applicant || {};
        const applicantTag = String(applicant.tag || '');
        const applicantName = String(applicant.name || '');
        const effClan = resolvedClanTag;

        const normalizedTag = normalizeTag(applicantTag);

        if (effClan && normalizedTag) {
          const historyRecord = await getPlayerHistoryRecord(effClan, normalizedTag);
          let historyMatched = false;

          if (historyRecord) {
            const hasDeparture = historyRecord.status === 'departed' || (historyRecord.movements || []).some((movement) => movement.type === 'departed');
            const aliasMatch = (historyRecord.aliases || []).some((alias) => alias.name.toLowerCase().trim() === applicantName.toLowerCase().trim());

            if (hasDeparture) {
              setHistoryNote('Applicant appears in your history with a prior departure');
              setHistoryLink(`/retired/${normalizedTag.replace('#', '')}`);
              historyMatched = true;
            } else if (aliasMatch) {
              setHistoryNote(`Name matches previous alias for ${historyRecord.primary_name}`);
              setHistoryLink(`/retired/${normalizedTag.replace('#', '')}`);
              historyMatched = true;
            }
          }

          if (!historyMatched) {
            const clanHistory = await getPlayerHistoryForClan(effClan);
            const aliasHit = clanHistory.find((record) =>
              (record.aliases || []).some((alias) => alias.name.toLowerCase().trim() === applicantName.toLowerCase().trim())
            );
            if (aliasHit) {
              setHistoryNote(`Name matches previous alias for ${aliasHit.primary_name}`);
              setHistoryLink(`/retired/${aliasHit.player_tag.replace('#', '')}`);
              historyMatched = true;
            }
          }

          if (!historyMatched) {
            try {
              const res2 = await fetch(`/api/departures?clanTag=${encodeURIComponent(effClan)}`, { cache: 'no-store' });
              const j2 = await res2.json();
              if (res2.ok && j2?.success) {
                const items = Array.isArray(j2.data) ? j2.data : [];
                const normalizedNoHash = normalizedTag.replace('#', '');
                const hit = items.find((d: any) => normalizeTag(d.memberTag)?.replace('#', '') === normalizedNoHash);
                if (hit) {
                  setHistoryNote('This player tag appears in your departed list');
                  setHistoryLink(`/retired/${normalizedNoHash}`);
                }
              }
            } catch (departureError) {
              console.warn('[ApplicantsPanel] Departures lookup failed', departureError);
            }
          }
        }
      } catch (historyError) {
        console.warn('[ApplicantsPanel] History lookup failed', historyError);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to evaluate');
    } finally {
      setLoading(false);
    }
  };

  const onSaveToPlayerDB = async () => {
    if (!result?.applicant || !result?.evaluation || !resolvedClanTag) return;
    setError('');
    try {
      const playerTag = normalizeTag(result.applicant.tag || '');
      if (!playerTag) {
        throw new Error('Missing applicant tag');
      }

      const payload = {
        clanTag: resolvedClanTag,
        playerTag,
        playerName: result.applicant.name ?? null,
        status,
        score: result.evaluation.score,
        recommendation: result.evaluation.recommendation,
        rushPercent: computeRushPercent(result.applicant),
        evaluation: result.evaluation,
        applicant: result.applicant,
      };

      const res = await fetch('/api/applicants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to save applicant (${res.status})`);
      }

      try {
        const existingHistory = await getPlayerHistoryRecord(resolvedClanTag, playerTag);
        await upsertPlayerHistory({
          clanTag: resolvedClanTag,
          playerTag,
          primaryName: result.applicant.name || existingHistory?.primary_name || playerTag,
          status: status as 'active' | 'departed' | 'applicant' | 'rejected',
          totalTenure: existingHistory?.total_tenure ?? 0,
          currentStint: existingHistory?.current_stint ?? null,
          movements: existingHistory?.movements ?? [],
          aliases: existingHistory?.aliases ?? [],
          notes: existingHistory?.notes ?? [],
        });
      } catch (historyError) {
        console.warn('[ApplicantsPanel] Failed to sync player history', historyError);
      }

      setSaved(true);
      await loadApplicants();
    } catch (e: any) {
      setError(e?.message || 'Failed to save applicant');
      setSaved(false);
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
    const ctx = resolvedClanTag ? ` for ${resolvedClanTag}` : '';
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

  const buildShortlist = async () => {
    setBuilding(true); setError(''); setShortlist([]);
    try {
      if (!resolvedClanTag) {
        throw new Error('Set a clan context before building a shortlist');
      }
      const sourceApplicants = applicants.length ? applicants : await loadApplicants();
      const candidateTags = (sourceApplicants || [])
        .filter((candidate) => ['shortlisted', 'consider-later'].includes(candidate.status))
        .map((candidate) => candidate.player_tag)
        .filter(Boolean);
      if (!candidateTags.length) {
        throw new Error('No stored candidates with status shortlisted or consider-later');
      }
      const effectiveClan = resolvedClanTag;
      const res = await fetch('/api/applicants/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag: effectiveClan || undefined,
          tags: candidateTags,
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
      const effectiveContext = resolvedClanTag || '';
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

  const recColor = (rec?: string) => rec === 'Excellent' ? 'text-emerald-400' : rec === 'Good' ? 'text-green-400' : rec === 'Fair' ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="space-y-6">
        {/* Evaluate Applicant Section */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-emerald-900/30 border border-emerald-700/30 rounded-lg flex items-center justify-center">
              <span className="text-emerald-400 font-bold">1</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Evaluate Individual Applicant</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Player Tag
                <Info className="w-4 h-4 text-slate-500 inline ml-1" />
              </label>
              <input 
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                placeholder="#XXXXXXXX" 
                value={tag} 
                onChange={e => setTag(e.target.value)} 
              />
              <p className="mt-2 text-sm text-slate-400">Clan context defaults to your current clan for fit scoring</p>
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
            <div className="mt-3 rounded border border-amber-800/50 bg-amber-900/30 p-3 text-amber-300 text-sm">
              <div className="font-semibold">History/Alias Audit</div>
              <div>{historyNote}</div>
              {historyLink && (
                <div className="mt-1">
                  <Link href={historyLink} target="_blank" rel="noreferrer" className="underline text-amber-200 hover:text-amber-100">
                    View retired profile
                  </Link>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-4 mb-4">
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          )}
          
          {result && (
            <div className="bg-slate-800/50 rounded-lg p-6">
              {/* Player Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
                    {result.applicant?.name} 
                    <span className="text-slate-400 font-normal">({result.applicant?.tag})</span>
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                    <span>TH {result.applicant?.townHallLevel ?? '—'}</span>
                    <span>Trophies {result.applicant?.trophies ?? '—'}</span>
                    <span>Rush {result?.applicant ? computeRushPercent(result.applicant) : 0}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-slate-100">{result.evaluation.score}</div>
                  <div className={`text-lg font-semibold ${recColor(result.evaluation.recommendation)}`}>
                    {result.evaluation.recommendation}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-300">Status:</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)} 
                    className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="shortlisted">Shortlisted</option>
                    <option value="consider-later">Consider Later</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <button 
                  onClick={onSaveToPlayerDB} 
                  disabled={saved || loadingApplicants} 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors" 
                  title="Save this evaluation for future reference"
                >
                  {saved ? '✓ Saved' : loadingApplicants ? 'Saving…' : 'Save Applicant'}
                </button>
                <button 
                  onClick={onCopyDiscord} 
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors" 
                  title="Copy a Discord-ready summary"
                >
                  {copied ? '✓ Copied!' : 'Copy Discord Summary'}
                </button>
                {saved && (
                  <span className="text-sm text-green-300 self-center bg-green-900/30 border border-green-700/30 px-3 py-1 rounded-full">
                    ✓ Saved
                  </span>
                )}
              </div>

              {/* Evaluation Breakdown */}
              <div className="bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
                <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                  <h4 className="font-semibold text-slate-100">Evaluation Breakdown</h4>
                </div>
                {result.evaluation.breakdown.map((b, i) => (
                  <div key={i} className="flex items-start justify-between p-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-slate-100 mb-1">{b.category}</div>
                      <div className="text-sm text-slate-300">{b.details}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-100">{b.points} / {b.maxPoints}</div>
                      <div className="text-xs text-slate-400">
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
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-blue-900/30 border border-blue-700/30 rounded-lg flex items-center justify-center">
              <span className="text-blue-400 font-bold">2</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Shortlist Builder</h2>
          </div>
          
          <p className="text-slate-300 mb-6">Build a ranked shortlist from saved candidates (status: shortlisted/consider-later). Apply filters to refine results.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Filters */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-100">Filters</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Top N</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={topN} 
                    onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Min TH
                    <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={16} 
                    value={minTh} 
                    onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Max TH
                    <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={16} 
                    value={maxTh} 
                    onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Min Score
                    <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={minScore} 
                    onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Min Trophies
                    <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    value={minTrophies} 
                    onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Max Rush %
                    <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={maxRush} 
                    onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} 
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Roles</label>
                <div className="flex flex-wrap gap-3">
                  {(['member','elder','coleader','leader'] as const).map(r => (
                    <label key={r} className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={!!roles[r]} 
                        onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} 
                        className="rounded border-slate-600 bg-slate-900/50 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-300 capitalize">{r}</span>
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
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
              <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                <h4 className="font-semibold text-slate-100">Shortlist Results ({shortlist.length} candidates)</h4>
              </div>
              {shortlist.map((item, idx) => (
                <div key={item.applicant.tag} className="p-4 flex items-start justify-between hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-slate-500">#{idx+1}</span>
                      <div>
                        <div className="font-semibold text-slate-100">{item.applicant.name}</div>
                        <div className="text-sm text-slate-400">{item.applicant.tag}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                      <span>Score: <span className="font-semibold">{item.evaluation.score}</span></span>
                      <span>Recommendation: <span className="font-semibold text-emerald-400">{item.evaluation.recommendation}</span></span>
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
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-purple-900/30 border border-purple-700/30 rounded-lg flex items-center justify-center">
              <span className="text-purple-400 font-bold">3</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Scan External Clan</h2>
          </div>
          
          <p className="text-slate-300 mb-6">Fetch a clan roster by tag, score all members against your clan&apos;s profile, and return the top N. Apply the same filters.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Clan Tag Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                External Clan Tag
                <Info className="w-4 h-4 text-slate-500 inline ml-1" />
              </label>
              <input 
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
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
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-slate-100 mb-4">Filters (same as shortlist builder)</h3>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Top N</label>
                <input 
                  type="number" 
                  min={1} 
                  max={50} 
                  value={topN} 
                  onChange={e => setTopN(Math.min(50, Math.max(1, Number(e.target.value)||10)))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Min TH
                  <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={16} 
                  value={minTh} 
                  onChange={e=>setMinTh(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Max TH
                  <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={16} 
                  value={maxTh} 
                  onChange={e=>setMaxTh(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Min Score
                  <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={minScore} 
                  onChange={e=>setMinScore(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Min Trophies
                  <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  value={minTrophies} 
                  onChange={e=>setMinTrophies(Math.max(0, Number(e.target.value)||0))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Max Rush %
                  <Info className="w-4 h-4 text-slate-500 inline ml-1" />
                </label>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={maxRush} 
                  onChange={e=>setMaxRush(Math.max(0, Math.min(100, Number(e.target.value)||0)))} 
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Roles</label>
              <div className="flex flex-wrap gap-3">
                {(['member','elder','coleader','leader'] as const).map(r => (
                  <label key={r} className="inline-flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={!!roles[r]} 
                      onChange={e=>setRoles(prev=>({ ...prev, [r]: e.target.checked }))} 
                      className="rounded border-slate-600 bg-slate-900/50 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-300 capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {scanResults.length > 0 && (
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
              <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                <h4 className="font-semibold text-slate-100">Scan Results ({scanResults.length} candidates)</h4>
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
                <div key={item.applicant.tag} className="p-4 flex items-start justify-between hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-slate-500">#{idx+1}</span>
                      <div>
                        <div className="font-semibold text-slate-100">{item.applicant.name}</div>
                        <div className="text-sm text-slate-400">{item.applicant.tag}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                      <span>Score: <span className="font-semibold">{item.evaluation.score}</span></span>
                      <span>Recommendation: <span className="font-semibold text-emerald-400">{item.evaluation.recommendation}</span></span>
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
