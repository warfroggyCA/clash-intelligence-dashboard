"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ClanHostConfig } from '@/lib/clan-config';
import { Button, GlassCard } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

type RosterMember = {
  tag: string;
  name: string | null;
  thLevel: number | null;
  role: string | null;
  warPreference?: string | null;
  lastUpdated: string | null;
};

type OnboardingClientProps = {
  clanConfig: ClanHostConfig;
};

export function OnboardingClient({ clanConfig }: OnboardingClientProps) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submissionDetails, setSubmissionDetails] = useState<{ primaryTag: string; linkedCount: number } | null>(null);
  const sessionStatus = useDashboardStore((state) => state.sessionStatus);
  const needsOnboarding = useDashboardStore((state) => state.needsOnboarding);
  const setNeedsOnboarding = useDashboardStore((state) => state.setNeedsOnboarding);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/roster', { credentials: 'same-origin' });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setError(body?.error || 'Failed to load roster.');
        setRoster([]);
      } else {
        setRoster(body.data?.roster || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster.');
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    if (!submissionDetails) return undefined;
    const timer = setTimeout(() => {
      router.push('/app');
    }, 2500);
    return () => clearTimeout(timer);
  }, [submissionDetails, router]);

  const toggleSelection = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const rosterMap = useMemo(() => {
    const map = new Map<string, RosterMember>();
    roster.forEach((member) => map.set(member.tag, member));
    return map;
  }, [roster]);

  const selectionOrder = useMemo(() => Array.from(selected), [selected]);

  const selectedDetails = useMemo(() => {
    return selectionOrder.map((tag) => {
      const fallback: RosterMember = {
        tag,
        name: null,
        thLevel: null,
        role: null,
        warPreference: null,
        lastUpdated: null,
      };
      return rosterMap.get(tag) ?? fallback;
    });
  }, [selectionOrder, rosterMap]);

  const selectedCount = selectedDetails.length;
  const hasSelection = selectedCount > 0;

  const handleSubmit = async () => {
    if (!selected.size) {
      setError('Select at least one account.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/submit-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTags: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setNeedsOnboarding(false);
      setSubmissionDetails(body.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submissionDetails) {
    const linkedExtras = Math.max(0, (submissionDetails.linkedCount || 1) - 1);
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10 text-slate-100">
        <GlassCard className="space-y-5">
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Clan onboarding</p>
          <h1 className="text-3xl font-semibold text-white">You&rsquo;re all set</h1>
          <p className="text-sm text-slate-400">
            We linked your dashboard identity to {clanConfig.displayName}. You can switch to the dashboard whenever you&rsquo;re ready.
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Primary tag</p>
            <p className="mt-1 text-2xl font-semibold tracking-wide text-white">{submissionDetails.primaryTag}</p>
            <p className="mt-3 text-xs text-slate-400">
              Linked minis: {linkedExtras > 0 ? `${linkedExtras} additional account${linkedExtras > 1 ? 's' : ''}` : 'none'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push('/app')}>Enter dashboard</Button>
            <Button variant="secondary" onClick={() => router.push('/settings')}>
              Manage access
            </Button>
          </div>
          <p className="text-xs text-slate-500">Redirecting you to the dashboard&hellip;</p>
        </GlassCard>
      </div>
    );
  }

  if (sessionStatus !== 'ready') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-slate-200">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-clash-gold" />
        <p className="mt-4 text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  if (!needsOnboarding) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 text-slate-100">
        <GlassCard className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Clan onboarding</p>
          <h1 className="text-3xl font-semibold">You&rsquo;re already onboarded</h1>
          <p className="text-sm text-slate-400">
            {clanConfig.displayName} already has your accounts linked. You can manage access in Settings or head back to the dashboard.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/app')}>Go to dashboard</Button>
            <Button variant="secondary" onClick={() => router.push('/settings')}>
              Manage access
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 text-slate-100">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-clash-gold/70">Clan onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold">Set up your clan access</h1>
        <p className="mt-2 text-sm text-slate-400">
          Select the account(s) you own in {clanConfig.displayName}. We’ll use them to personalize the dashboard and link your minis automatically.
        </p>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Current roster</p>
            {roster.length > 0 && (
              <p className="text-sm text-slate-400">
                Last updated {roster[0]?.lastUpdated ? new Date(roster[0].lastUpdated).toLocaleString() : 'recently'}
              </p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadRoster()} disabled={loading} loading={loading}>
            Refresh roster
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading roster…</p>
        ) : error ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : roster.length === 0 ? (
          <p className="text-sm text-slate-400">No roster data found for this clan.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roster.map((member) => {
              const isSelected = selected.has(member.tag);
              return (
                <button
                  key={member.tag}
                  onClick={() => toggleSelection(member.tag)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected ? 'border-clash-gold bg-clash-gold/10' : 'border-white/10 hover:border-clash-gold/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-white">{member.name ?? member.tag}</p>
                      <p className="text-xs text-slate-400">{member.tag}</p>
                    </div>
                    {isSelected && <span className="text-sm text-clash-gold">Selected</span>}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    TH {member.thLevel ?? '—'} · {member.role ?? 'Member'} · {member.warPreference || 'war pref unknown'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Selected accounts</p>
            <p className="text-sm text-slate-400">
              {hasSelection
                ? `Primary identity: ${selectionOrder[0]}`
                : 'No accounts selected yet.'}
            </p>
          </div>
          {hasSelection && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear all
            </Button>
          )}
        </div>
        {hasSelection ? (
          <div className="space-y-3">
            {selectedDetails.map((member, index) => (
              <div
                key={member.tag}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">{member.name ?? member.tag}</p>
                  <p className="text-xs text-slate-400">{member.tag}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    {index === 0 ? 'Primary identity' : 'Linked mini'}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 text-sm text-slate-300 sm:items-end">
                  <p className="text-xs text-slate-400">
                    TH {member.thLevel ?? '—'} · {member.role ?? 'Member'} · {member.warPreference || 'War opt unknown'}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => toggleSelection(member.tag)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
            Choose your accounts from the roster above. Your first selection becomes your dashboard identity; any others link as hidden minis.
          </div>
        )}
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
        <p className="text-xs text-slate-400">
          Select every account you control. We’ll keep the links private unless you choose to surface them.
        </p>
        <Button onClick={handleSubmit} disabled={submitting || !hasSelection} loading={submitting}>
          {submitting ? 'Saving…' : 'Complete onboarding'}
        </Button>
      </div>
    </div>
  );
}
