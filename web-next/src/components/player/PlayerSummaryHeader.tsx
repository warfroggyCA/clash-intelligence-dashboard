'use client';

import React from 'react';
import { PlayerProfileSummary } from '@/lib/player-profile';
import { LeagueBadge, TownHallBadge, Button } from '@/components/ui';
import { getRoleBadgeVariant } from '@/lib/leadership';

interface PlayerSummaryHeaderProps {
  summary: PlayerProfileSummary;
}

export const PlayerSummaryHeader: React.FC<PlayerSummaryHeaderProps> = ({ summary }) => {
  const badge = getRoleBadgeVariant(summary.role);
  const cleanTag = summary.tag.replace('#', '').toUpperCase();
  const joinDate = summary.joinDate ? new Date(summary.joinDate) : null;
  const lastSeen = summary.lastSeen ? new Date(summary.lastSeen) : null;
  const leagueLabel = summary.league?.name || 'Unranked';

  const handleCopy = (value: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => console.warn('Clipboard copy failed'));
    }
  };

  const handleCopyProfileLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    handleCopy(`${origin}/player/${cleanTag}`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
      <div className="rounded-3xl border border-brand-border/60 bg-brand-surfaceRaised/80 px-5 py-4 text-slate-100 shadow-[0_18px_36px_-26px_rgba(8,15,31,0.7)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <span className={`role-badge role-badge--${badge.tone} inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold`} title={badge.label}>
                {badge.icon && <span aria-hidden className="text-xs">{badge.icon}</span>}
                <span className="role-badge__label">{badge.label}</span>
              </span>
              <span className="uppercase tracking-[0.28em] text-slate-400">#{cleanTag}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <LeagueBadge trophies={summary.league.trophies} showText={false} size="xl" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">{leagueLabel}</span>
              </div>
              <div className="space-y-2">
                <h1
                  className="text-3xl font-semibold text-slate-100 drop-shadow-sm sm:text-4xl"
                  style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }}
                >
                  {summary.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span>{summary.clanName}</span>
                  <span aria-hidden>•</span>
                  <span>{summary.clanTag}</span>
                  {joinDate && (
                    <>
                      <span aria-hidden>•</span>
                      <span>Joined {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(joinDate)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 text-right">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <TownHallBadge level={summary.townHallLevel} size="md" />
              <span className="font-semibold">TH{summary.townHallLevel}</span>
            </div>
            {lastSeen && (
              <p className="text-xs text-muted-contrast">Last seen {Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(lastSeen)}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="Activity" value={summary.activityLevel} tone="positive" />
          <SummaryStat
            label="Rush Score"
            value={`${summary.rushScore.toFixed(1)}%`}
            tone={summary.rushScore >= 70 ? 'warning' : summary.rushScore >= 40 ? 'neutral' : 'positive'}
          />
          <SummaryStat
            label="Donations"
            value={`${summary.donationBalance.given.toLocaleString()} / ${summary.donationBalance.received.toLocaleString()}`}
            helper={`Net ${summary.donationBalance.balance >= 0 ? '+' : ''}${summary.donationBalance.balance.toLocaleString()}`}
          />
          {lastSeen && (
            <SummaryStat
              label="Last Seen"
              value={Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(lastSeen)}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-brand-border/60 bg-brand-surfaceRaised/60 px-5 py-4 text-slate-100 shadow-[0_18px_32px_-26px_rgba(8,15,31,0.65)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">Quick Links</h2>
          <span className="text-xs text-slate-400">Share with leadership</span>
        </div>
        <div className="grid gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            className="justify-start border-slate-500/40 bg-white/10 text-slate-100 hover:bg-white/20"
            onClick={() => handleCopy(summary.tag)}
          >
            Copy Player Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start border-slate-500/40 bg-white/10 text-slate-100 hover:bg-white/20"
            onClick={handleCopyProfileLink}
          >
            Copy Profile Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start border-slate-500/40 bg-white/10 text-slate-100 hover:bg-white/20"
            onClick={() => {
              window.open(`https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${encodeURIComponent(summary.tag)}`, '_blank');
            }}
          >
            View in Clash of Clans
          </Button>
        </div>
      </div>
    </div>
  );
};

interface SummaryStatProps {
  label: string;
  value: string;
  helper?: string;
  tone?: 'positive' | 'warning' | 'neutral';
}

const toneClasses: Record<NonNullable<SummaryStatProps['tone']>, string> = {
  positive: 'text-emerald-200',
  warning: 'text-amber-200',
  neutral: 'text-slate-200',
};

const SummaryStat: React.FC<SummaryStatProps> = ({ label, value, helper, tone = 'neutral' }) => {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm shadow-inner">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClasses[tone]}`}>{value}</p>
      {helper ? <p className="text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
};

export default PlayerSummaryHeader;
