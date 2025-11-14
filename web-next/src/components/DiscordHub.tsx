"use client";

import React, { useCallback, useEffect, useState } from 'react';
import DiscordPublisher from '@/components/DiscordPublisher';
import { GlassCard } from '@/components/ui';
import type { Roster } from '@/types';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

interface DiscordHubProps {
  clanTag: string;
  clanName?: string | null;
  roster: Roster | null;
}

const widgetId = process.env.NEXT_PUBLIC_DISCORD_WIDGET_ID;
const widgetChannel = process.env.NEXT_PUBLIC_DISCORD_WIDGET_CHANNEL_ID;
const widgetTheme = process.env.NEXT_PUBLIC_DISCORD_WIDGET_THEME ?? 'dark';
const inviteUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? null;

const buildWidgetUrl = (): string | null => {
  if (!widgetId) return null;
  const params = new URLSearchParams({ id: widgetId, theme: widgetTheme });
  if (widgetChannel) {
    params.set('channel', widgetChannel);
  }
  return `https://discord.com/widget?${params.toString()}`;
};

const widgetUrl = buildWidgetUrl();

export const DiscordHub: React.FC<DiscordHubProps> = ({ clanTag, clanName, roster }) => {
  const loadRoster = useDashboardStore((state) => state.loadRoster);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [warPlanSummary, setWarPlanSummary] = useState<any | null>(null);
  const [loadingWarPlan, setLoadingWarPlan] = useState(false);
  const hasAutoRequestedRoster = React.useRef(false);

  useEffect(() => {
    const fetchWarPlanSummary = async () => {
      if (!clanTag) {
        setWarPlanSummary(null);
        return;
      }
      setLoadingWarPlan(true);
      try {
        const params = new URLSearchParams({ ourClanTag: clanTag });
        const res = await fetch(`/api/v2/war-planning/plan?${params.toString()}`, { cache: 'no-store' });
        const body = await res.json();
        if (!res.ok || !body?.success || !body?.data || !body.data.analysis) {
          setWarPlanSummary(null);
          return;
        }
        const plan = body.data;
        const highlights = (plan.analysis.slotBreakdown ?? []).map((slot: any) => ({
          slot: slot.slot,
          ourName: slot.ourName ?? slot.ourTag ?? null,
          opponentName: slot.opponentName ?? slot.opponentTag ?? null,
          summary: slot.summary ?? 'Matchup insight unavailable',
        }));
        setWarPlanSummary({
          opponentName: plan.opponentClanName ?? plan.opponentClanTag ?? null,
          opponentTag: plan.opponentClanTag ?? null,
          confidence: plan.analysis.summary?.confidence ?? null,
          outlook: plan.analysis.summary?.outlook ?? null,
          recommendations: plan.analysis.recommendations ?? null,
          slotHighlights: highlights,
        });
      } catch (error) {
        console.warn('[DiscordHub] Failed to load war plan summary', error);
        setWarPlanSummary(null);
      } finally {
        setLoadingWarPlan(false);
      }
    };
    void fetchWarPlanSummary();
  }, [clanTag]);

  const handleLoadRoster = useCallback(async () => {
    if (!clanTag) return;
    setLoadingRoster(true);
    try {
      await loadRoster(clanTag);
    } finally {
      setLoadingRoster(false);
    }
  }, [clanTag, loadRoster]);

  useEffect(() => {
    if (!clanTag) return;
    if (roster) return;
    if (loadingRoster) return;
    if (hasAutoRequestedRoster.current) return;
    hasAutoRequestedRoster.current = true;
    void handleLoadRoster();
  }, [clanTag, roster, loadingRoster, handleLoadRoster]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-100">Discord Command Center</h1>
        <p className="text-sm text-slate-400">
          Keep your clan looped in on Discord without leaving the dashboard.
        </p>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <GlassCard className="p-0 overflow-hidden">
          {widgetUrl ? (
            <div className="flex h-[600px] flex-col">
              <header className="px-4 py-3 border-b border-brand-border/50 bg-brand-surfaceSubtle/70">
                <h2 className="text-lg font-semibold text-slate-100">
                  {clanName ? `${clanName} Discord Feed` : 'Discord Feed'}
                </h2>
                <p className="text-xs text-slate-400">
                  Live view of your public Discord channel. Use the buttons in Discord to interact.
                </p>
              </header>
              <iframe
                src={widgetUrl}
                title="Discord Feed"
                allowTransparency
                frameBorder={0}
                className="flex-1 w-full h-full bg-[#2b2d31]"
              />
            </div>
          ) : (
            <div className="p-6 space-y-4 text-sm text-slate-300">
              <h2 className="text-xl font-semibold text-slate-100">Connect your Discord</h2>
              <p>
                Enable the Discord server widget to embed a live channel feed here:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li>In Discord, open <span className="font-mono bg-black/30 px-1 py-0.5 rounded">Server Settings → Widget</span>.</li>
                <li>Toggle <strong>Enable Server Widget</strong>.</li>
                <li>Copy the <strong>Server ID</strong> (and optional Channel ID) into your environment variables:
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><span className="font-mono bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_DISCORD_WIDGET_ID</span></li>
                    <li><span className="font-mono bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_DISCORD_WIDGET_CHANNEL_ID</span> (optional)</li>
                  </ul>
                </li>
              </ol>
              <p>
                After updating your environment, reload the dashboard to see the embedded feed.
              </p>
              {inviteUrl && (
                <p>
                  Need access? Join using{' '}
                  <a
                    className="text-indigo-300 underline hover:text-indigo-200"
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    this invite link
                  </a>.
                </p>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <header className="px-4 py-3 border-b border-brand-border/50 bg-brand-surfaceSubtle/70">
            <h2 className="text-lg font-semibold text-slate-100">Broadcast to Discord</h2>
            <p className="text-xs text-slate-400">
              Generate ready-to-send exhibits and push them to your Discord channels.
            </p>
          </header>
          <div className="p-4">
            {roster ? (
              <DiscordPublisher clanData={roster} clanTag={clanTag} warPlanSummary={warPlanSummary} />
            ) : (
              <div className="space-y-4 text-sm text-slate-300">
                <p>
                  Load your clan roster to enable Discord publishing tools. We use the latest
                  roster snapshot to generate player exhibits and leaderboards.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleLoadRoster}
                    disabled={!clanTag || loadingRoster}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 disabled:text-slate-500 text-white font-semibold rounded-lg transition-colors"
                  >
                    {loadingRoster ? 'Loading roster…' : 'Load clan roster'}
                  </button>
                  <p className="text-xs text-slate-500">
                    Current clan tag: {clanTag || 'not set'}
                  </p>
                </div>
                {loadingWarPlan ? (
                  <p className="text-xs text-slate-500">Loading war plan summary…</p>
                ) : null}
                <p className="text-xs text-slate-500">
                  Tip: switch to the Roster tab first if you need to pick a different clan.
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default DiscordHub;
