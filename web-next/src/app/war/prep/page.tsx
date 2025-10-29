"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, GlassCard } from '@/components/ui';
import { normalizeTag } from '@/lib/tags';
import Link from 'next/link';

const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

type OpponentProfile = {
  clan: {
    tag: string;
    name?: string;
    level?: number;
    league?: { id: number; name: string } | null;
    memberCount?: number;
    warRecord?: { wins?: number; losses?: number; ties?: number; winStreak?: number };
    warFrequency?: string | null;
    publicWarLog?: boolean;
  };
  roster: Array<{
    tag: string;
    name: string;
    role?: string;
    trophies?: number;
    donations?: number;
    donationsReceived?: number;
    th?: number | null;
    readinessScore?: number | null;
    isMax?: boolean;
    isRushed?: boolean;
  }>;
  thDistribution: Record<string, number>;
  recentForm: { lastWars: number; wlt: { w: number; l: number; t: number }; avgStars?: number | null; avgDestruction?: number | null; teamSizes?: Record<string, number> };
  briefing: { bullets: string[]; copy: string };
  limitations: { privateWarLog?: boolean; couldNotDetectOpponent?: boolean; partialPlayerDetails?: boolean };
  detectedOpponentTag?: string | null;
};

function WarPrepPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  
  // Simple state - no Zustand
  const [ourClanTag, setOurClanTag] = useState('');
  const [ourClanName, setOurClanName] = useState('');
  const [opponentInput, setOpponentInput] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [enrich, setEnrich] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OpponentProfile | null>(null);

  const cleanOpponent = useMemo(() => (opponentInput ? normalizeTag(opponentInput) : ''), [opponentInput]);
  const cleanOurClan = useMemo(() => (ourClanTag ? normalizeTag(ourClanTag) : ''), [ourClanTag]);

  // Fetch our clan info on mount (SSOT from API)
  useEffect(() => {
    async function loadOurClan() {
      try {
        const res = await fetch('/api/v2/roster?mode=latest', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setOurClanTag(data.data.clan?.tag || '');
            setOurClanName(data.data.clan?.name || '');
          }
        }
      } catch (error) {
        console.warn('[WarPrep] Failed to load our clan info:', error);
      }
    }
    loadOurClan();
  }, []);

  // Persist opponent data to localStorage
  useEffect(() => {
    if (profile) {
      try {
        localStorage.setItem('war-prep-opponent', JSON.stringify({
          profile,
          timestamp: Date.now(),
          opponentTag: profile.clan.tag,
          autoDetect,
          enrich
        }));
      } catch (error) {
        console.warn('[WarPrep] Failed to save to localStorage:', error);
      }
    }
  }, [profile, autoDetect, enrich]);

  // Restore opponent data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('war-prep-opponent');
      if (saved) {
        const data = JSON.parse(saved);
        const age = Date.now() - data.timestamp;
        // Keep data for 24 hours
        if (age < 24 * 60 * 60 * 1000 && data.profile) {
          console.log('[WarPrep] Restored opponent from localStorage');
          setProfile(data.profile);
          setAutoDetect(data.autoDetect ?? true);
          setEnrich(data.enrich ?? 12);
          if (data.opponentTag) {
            setOpponentInput(data.opponentTag);
          }
        } else {
          // Data too old, clear it
          localStorage.removeItem('war-prep-opponent');
        }
      }
    } catch (error) {
      console.warn('[WarPrep] Failed to restore from localStorage:', error);
    }
  }, []); // Only run on mount

  const onFetch = async (opts: { pin?: boolean } = {}) => {
    // Check if we're already showing the same opponent
    const targetOpponentTag = cleanOpponent || (autoDetect ? 'auto-detect' : '');
    const currentOpponentTag = profile?.clan?.tag;
    
    if (targetOpponentTag && currentOpponentTag && 
        normalizeTag(targetOpponentTag) === normalizeTag(currentOpponentTag) &&
        !opts.pin) {
      console.log('[WarPrep] Same opponent already loaded, skipping fetch');
      return;
    }
    
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const params = new URLSearchParams();
      if (autoDetect && cleanOurClan) params.set('autoDetect', 'true');
      if (!autoDetect && cleanOpponent) params.set('opponentTag', cleanOpponent);
      if (autoDetect && cleanOurClan) params.set('ourClanTag', cleanOurClan);
      if (enrich) params.set('enrich', String(enrich));
      // If autodetect is disabled but user provided both, include both (API will prefer manual)
      if (!autoDetect && cleanOpponent && cleanOurClan) params.set('ourClanTag', cleanOurClan);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(`/api/war/opponent?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        setProfile(body.data as OpponentProfile);
        // Update URL for deep link
        const url = new URL(window.location.href);
        url.searchParams.set('autoDetect', String(autoDetect));
        if (!autoDetect && cleanOpponent) url.searchParams.set('opponentTag', cleanOpponent);
        if (cleanOurClan) url.searchParams.set('ourClanTag', cleanOurClan);
        url.searchParams.set('enrich', String(enrich));
        router.replace(`${url.pathname}?${url.searchParams.toString()}`);
        // Persist pin server-side (cross device)
        if (opts.pin !== false && cleanOurClan && (cleanOpponent || body?.data?.clan?.tag)) {
          const oppTag = cleanOpponent || body.data.clan.tag;
          try {
            await fetch('/api/war/pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ourClanTag: cleanOurClan, 
                opponentTag: oppTag,
                profileData: body.data
              }),
            });
          } catch {}
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch opponent profile');
    } finally {
      setLoading(false);
    }
  };

  // On mount: if URL has params, auto-load; else, try pinned opponent for our clan
  useEffect(() => {
    const sp = search;
    if (!sp) {
      console.log('[WarPrep] No search params, loading pinned opponent');
      return;
    }
    const qOpp = sp.get('opponentTag');
    const qAuto = sp.get('autoDetect');
    const qOur = sp.get('ourClanTag');
    const qEnrich = sp.get('enrich');
    console.log('[WarPrep] URL params:', { qOpp, qAuto, qOur, qEnrich });
    let needsFetch = false;
    if (qEnrich) setEnrich(Math.max(4, Math.min(50, Number(qEnrich) || 12)));
    if (qAuto != null) {
      const ad = qAuto === 'true';
      setAutoDetect(ad);
      if (ad) needsFetch = true;
    }
    if (qOpp) {
      console.log('[WarPrep] Found opponent in URL, setting input and fetching');
      setOpponentInput(qOpp);
      if (!qAuto || qAuto === 'false') needsFetch = true;
    }
    if (needsFetch) {
      console.log('[WarPrep] Fetching from URL params');
      void onFetch({ pin: false });
      return;
    }
    // If no params, try pinned opponent
    const loadPinned = async () => {
      const oc = cleanOurClan;
      if (!oc) {
        console.log('[WarPrep] No clan tag, skipping pinned opponent load');
        return;
      }
      console.log('[WarPrep] Loading pinned opponent for clan:', oc);
      try {
        const res = await fetch(`/api/war/pin?ourClanTag=${encodeURIComponent(oc)}`, { cache: 'no-store' });
        const body = await res.json();
        console.log('[WarPrep] Pinned opponent response:', body);
        if (res.ok && body?.success && body?.data?.opponent_tag) {
          console.log('[WarPrep] Loading pinned opponent:', body.data.opponent_tag);
          setAutoDetect(false);
          setOpponentInput(body.data.opponent_tag);
          
          // If we have cached profile data, use it directly
          if (body.data.profile_data) {
            console.log('[WarPrep] Using cached profile data');
            setProfile(body.data.profile_data);
          } else {
            // Otherwise fetch fresh data
            await onFetch({ pin: false });
          }
        } else {
          console.log('[WarPrep] No pinned opponent found');
        }
      } catch (error) {
        console.error('[WarPrep] Error loading pinned opponent:', error);
      }
    };
    void loadPinned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cleanOurClan]);

  const thChips = useMemo(() => {
    if (!profile) return [] as Array<{ th: string; count: number }>;
    return Object.entries(profile.thDistribution)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([th, count]) => ({ th, count }));
  }, [profile]);

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-6">
      {/* Prominent Back Button */}
      <div className="flex items-center gap-3 mb-4">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/60 transition-colors" 
          title="Return to the main dashboard"
        >
          <span className="text-lg">←</span>
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">⚔️ War Prep</h1>
          <p className="text-sm text-slate-400">
            {profile ? (
              <span>
                Currently analyzing: <span className="font-semibold text-slate-300">{profile.clan.name}</span>
              </span>
            ) : (
              "Analyze your opponent's clan before battle day."
            )}
          </p>
        </div>
        {profile && (
          <Button
            onClick={() => {
              setProfile(null);
              setOpponentInput('');
              setError(null);
              localStorage.removeItem('war-prep-opponent');
            }}
            variant="ghost"
            className="text-slate-400 hover:text-red-400"
          >
            Clear & Analyze New
          </Button>
        )}
      </div>

      <GlassCard className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400" title="Enter the opponent clan tag (e.g., #2PR8R8V8P)">Opponent Tag</label>
            <input
              className="w-full rounded-xl border border-brand-border/60 bg-brand-surfaceSubtle px-3 py-2 text-sm text-slate-100 outline-none"
              placeholder="#OPPONENT"
              value={opponentInput}
              onChange={(e) => setOpponentInput(e.target.value)}
              disabled={autoDetect}
            />
            <p className="text-xs text-slate-500">{cleanOpponent}</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400" title="Use current war pairing to find the opponent. If no pairing or private war log, enter a tag manually.">Auto-detect Opponent</label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              <span className="text-sm text-slate-200">Use current war (our clan: {cleanOurClan || 'n/a'})</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400" title="How many top players to fetch hero/TH data for. Higher values take longer but give better coverage.">Enrich Players</label>
            <input
              type="number"
              min={4}
              max={50}
              value={enrich}
              onChange={(e) => setEnrich(Math.max(4, Math.min(50, Number(e.target.value) || 12)))}
              className="w-24 rounded-xl border border-brand-border/60 bg-brand-surfaceSubtle px-3 py-2 text-sm text-slate-100 outline-none"
            />
            <p className="text-xs text-slate-500">Top N players to fetch hero/TH for</p>
            <div className="mt-1 flex items-center gap-2">
              <input type="checkbox" id="fullEnrich" onChange={(e) => setEnrich(e.target.checked ? 50 : 12)} />
              <label htmlFor="fullEnrich" className="text-xs text-slate-300" title="Fetch detailed data for the full roster (50). Calls are globally rate-limited to stay within CoC API rules.">Full roster (50) — paced</label>
            </div>
          </div>
        </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => onFetch()} 
              disabled={loading || Boolean(profile && cleanOpponent && profile.clan?.tag && normalizeTag(cleanOpponent) === normalizeTag(profile.clan.tag))} 
              loading={loading} 
              title="Fetch opponent profile and pin it for your clan"
            >
              {profile && cleanOpponent && profile.clan?.tag && normalizeTag(cleanOpponent) === normalizeTag(profile.clan.tag)
                ? 'Same Opponent Already Loaded' 
                : 'Fetch Opponent Profile'
              }
            </Button>
        </div>
        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>
        )}
      </GlassCard>

      {profile && (
        <div className="space-y-4">
          <GlassCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">{profile.clan.name} <span className="text-slate-400">({profile.clan.tag})</span></p>
                <p className="text-xs text-slate-400">Lv {profile.clan.level ?? '—'} • {profile.clan.league?.name ?? 'No league'} • Members {profile.clan.memberCount ?? '—'}</p>
              </div>
              <div className="text-xs text-slate-400">
                War record: {profile.clan.warRecord?.wins ?? 0}-{profile.clan.warRecord?.losses ?? 0}-{profile.clan.warRecord?.ties ?? 0} • Streak {profile.clan.warRecord?.winStreak ?? 0}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3" title="Count of Town Hall levels among enriched players (increase Enrich for more coverage)">
                <p className="text-xs uppercase tracking-wide text-slate-400">TH Distribution</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {thChips.length ? thChips.map((c) => (
                    <span key={c.th} className="rounded-full border border-brand-border/60 bg-black/20 px-2 py-0.5 text-xs text-slate-200">TH{c.th}: {c.count}</span>
                  )) : <span className="text-xs text-slate-500">Limited until player details fetched</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3" title="W-L-T, average stars and destruction from the opponent’s recent war log (if public)">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recent Form</p>
                <p className="mt-2 text-sm text-slate-200">{profile.recentForm.wlt.w}-{profile.recentForm.wlt.l}-{profile.recentForm.wlt.t} • {profile.recentForm.avgStars?.toFixed(2) ?? '—'}⭐ • {profile.recentForm.avgDestruction ? Math.round(profile.recentForm.avgDestruction) : '—'}%</p>
              </div>
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3" title="Public means we can compute recent metrics; private limits history.">
                <p className="text-xs uppercase tracking-wide text-slate-400">War Log</p>
                <p className="mt-2 text-sm text-slate-200">{profile.clan.publicWarLog ? 'Public' : 'Private/Unavailable'}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-slate-100">Briefing</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-200">
              {profile.briefing.bullets.map((b, i) => (<li key={`b-${i}`}>{b}</li>))}
            </ul>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-slate-100">Roster (Top {enrich} enriched)</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-brand-border/60 text-slate-400">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Tag</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3" title="Town Hall level (from enriched players)">TH</th>
                    <th className="py-2 pr-3" title="Hero readiness vs Town Hall caps (AQ/GW/RC weighted more than BK)">Readiness</th>
                    <th className="py-2 pr-3">Donations</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.roster.map((m) => (
                    <tr key={m.tag} className="border-b border-brand-border/40">
                      <td className="py-2 pr-3">{m.name}</td>
                      <td className="py-2 pr-3 text-slate-400">{m.tag}</td>
                      <td className="py-2 pr-3">{m.role || '—'}</td>
                      <td className="py-2 pr-3">{m.th ?? '—'}</td>
                      <td className="py-2 pr-3">{m.readinessScore != null ? `${m.readinessScore}%` : '—'}</td>
                      <td className="py-2 pr-3">{m.donations ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(profile.limitations.couldNotDetectOpponent || profile.limitations.privateWarLog || profile.limitations.partialPlayerDetails) && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {profile.limitations.couldNotDetectOpponent ? 'Could not auto-detect opponent. Enter a tag to proceed. ' : ''}
                {profile.limitations.privateWarLog ? 'Opponent war log is private—history limited. ' : ''}
                {profile.limitations.partialPlayerDetails ? 'Enriched a subset of players to respect rate limits.' : ''}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

export default function WarPrepPage() {
  const clanName = useDashboardStore(selectors.clanName);
  return (
    <DashboardLayout clanName={clanName || undefined}>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Suspense fallback={<div className="mx-auto max-w-6xl p-4">Loading war preparation...</div>}>
          <WarPrepPageContent />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
