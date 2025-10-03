"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, GlassCard } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';

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
  const ourClanTag = useDashboardStore((s) => s.clanTag || s.homeClan || '');
  const router = useRouter();
  const search = useSearchParams();
  const [opponentInput, setOpponentInput] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [enrich, setEnrich] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OpponentProfile | null>(null);

  const cleanOpponent = useMemo(() => (opponentInput ? normalizeTag(opponentInput) : ''), [opponentInput]);
  const cleanOurClan = useMemo(() => (ourClanTag ? normalizeTag(ourClanTag) : ''), [ourClanTag]);

  const onFetch = async (opts: { pin?: boolean } = {}) => {
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
              body: JSON.stringify({ ourClanTag: cleanOurClan, opponentTag: oppTag }),
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
    if (!sp) return;
    const qOpp = sp.get('opponentTag');
    const qAuto = sp.get('autoDetect');
    const qOur = sp.get('ourClanTag');
    const qEnrich = sp.get('enrich');
    let needsFetch = false;
    if (qEnrich) setEnrich(Math.max(4, Math.min(50, Number(qEnrich) || 12)));
    if (qAuto != null) {
      const ad = qAuto === 'true';
      setAutoDetect(ad);
      if (ad) needsFetch = true;
    }
    if (qOpp) {
      setOpponentInput(qOpp);
      if (!qAuto || qAuto === 'false') needsFetch = true;
    }
    if (needsFetch) {
      void onFetch({ pin: false });
      return;
    }
    // If no params, try pinned opponent
    const loadPinned = async () => {
      const oc = cleanOurClan;
      if (!oc) return;
      try {
        const res = await fetch(`/api/war/pin?ourClanTag=${encodeURIComponent(oc)}`, { cache: 'no-store' });
        const body = await res.json();
        if (res.ok && body?.success && body?.data?.opponent_tag) {
          setAutoDetect(false);
          setOpponentInput(body.data.opponent_tag);
          await onFetch({ pin: false });
        }
      } catch {}
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
      <div>
        <h1 className="text-xl font-semibold text-slate-100">War Prep</h1>
        <p className="text-sm text-slate-400">Enter an opponent tag or auto-detect your current opponent.</p>
      </div>

      <GlassCard className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Opponent Tag</label>
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
            <label className="text-xs uppercase tracking-wide text-slate-400">Auto-detect Opponent</label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              <span className="text-sm text-slate-200">Use current war (our clan: {cleanOurClan || 'n/a'})</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Enrich Players</label>
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
              <label htmlFor="fullEnrich" className="text-xs text-slate-300">Full roster (50) — paced</label>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onFetch()} disabled={loading} loading={loading}>
            Fetch Opponent Profile
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
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">TH Distribution</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {thChips.length ? thChips.map((c) => (
                    <span key={c.th} className="rounded-full border border-brand-border/60 bg-black/20 px-2 py-0.5 text-xs text-slate-200">TH{c.th}: {c.count}</span>
                  )) : <span className="text-xs text-slate-500">Limited until player details fetched</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recent Form</p>
                <p className="mt-2 text-sm text-slate-200">{profile.recentForm.wlt.w}-{profile.recentForm.wlt.l}-{profile.recentForm.wlt.t} • {profile.recentForm.avgStars?.toFixed(2) ?? '—'}⭐ • {profile.recentForm.avgDestruction ? Math.round(profile.recentForm.avgDestruction) : '—'}%</p>
              </div>
              <div className="rounded-2xl border border-brand-border/60 bg-brand-surfaceSubtle p-3">
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
                    <th className="py-2 pr-3">TH</th>
                    <th className="py-2 pr-3">Readiness</th>
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
  return (
    <Suspense fallback={<div>Loading war preparation...</div>}>
      <WarPrepPageContent />
    </Suspense>
  );
}
