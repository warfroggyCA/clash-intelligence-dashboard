"use client";

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Member } from '@/types';
import { TownHallBadge, LeagueBadge, HeroLevel, Button, GlassCard } from '@/components/ui';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  getTownHallLevel,
} from '@/lib/business/calculations';
import { HERO_MAX_LEVELS } from '@/types';
import { getRoleBadgeVariant } from '@/lib/leadership';
import { resolveMemberLeague } from '@/lib/member-league';
import { resolveMemberActivity } from '@/lib/activity/resolve-member-activity';

interface PlayerCardProps {
  member: Member;
  onSelect?: (member: Member) => void;
  clanHeroAverages?: Record<string, number | { average: number; count: number }>;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ member, onSelect, clanHeroAverages = {} }) => {
  const rushPercent = calculateRushPercentage(member);
  const donations = calculateDonationBalance(member);
  const activity = resolveMemberActivity(member);
  const th = getTownHallLevel(member);
  const heroCaps = HERO_MAX_LEVELS[th] || {};
  const roleVariant = getRoleBadgeVariant(member.role);
  const showRoleBadge = roleVariant.tone !== 'member';
  const router = useRouter();
  const leagueInfo = resolveMemberLeague(member);
  
  // Extract clan average and count for a hero
  const getClanAverage = (heroKey: string): { average: number; count: number } | null => {
    const data = clanHeroAverages[heroKey.toLowerCase()];
    if (!data) return null;
    
    // Handle both formats: number (legacy) or { average, count } (new)
    if (typeof data === 'number' && Number.isFinite(data) && data > 0) {
      // Legacy format: just average, estimate count
      return { average: data, count: Math.max(1, Math.round(data)) };
    }
    
    if (typeof data === 'object' && data !== null && 'average' in data && 'count' in data) {
      const avg = (data as { average: number; count: number }).average;
      const cnt = (data as { average: number; count: number }).count;
      if (typeof avg === 'number' && Number.isFinite(avg) && avg > 0 && typeof cnt === 'number' && cnt > 0) {
        return { average: avg, count: cnt };
      }
    }
    
    return null;
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(member);
      return;
    }
    const normalizedTag = member.tag.startsWith('#') ? member.tag.slice(1) : member.tag;
    router.push(`/player/${normalizedTag}`);
  };

  return (
    <GlassCard
      className={`player-card relative flex flex-col gap-4 p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl ${
        rushPercent >= 70 ? 'ring-2 ring-rose-400/50' : rushPercent >= 40 ? 'ring-2 ring-amber-300/40' : 'ring-1 ring-emerald-300/30'
      }`}
      role="button"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h3
            className="text-2xl font-bold text-high-contrast drop-shadow-sm leading-tight"
            style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", sans-serif' }}
          >
            {member.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-medium-contrast">
            <span className="uppercase tracking-wide text-muted-contrast">{member.tag}</span>
            {showRoleBadge ? (
              <span
                className={`role-badge role-badge--${roleVariant.tone} inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold`}
              >
                {roleVariant.icon && <span aria-hidden className="text-xs">{roleVariant.icon}</span>}
                <span className="role-badge__label">{roleVariant.label}</span>
              </span>
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-muted-contrast">Member</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-medium-contrast">
            <TownHallBadge level={th} size="md" />
            <span className="text-[11px] uppercase tracking-wide text-muted-contrast">TH {th}</span>
          </div>
        </div>
        <LeagueBadge
          league={leagueInfo.name || 'Unranked'}
          trophies={leagueInfo.trophies ?? member.trophies ?? undefined}
          tier={leagueInfo.tier}
          size="lg"
          showText={false}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <StatChip
            label="Trophies"
            icon={<StatIcon src="/assets/icons/trophy.svg" alt="Trophy icon" />}
            tooltip="Current trophy count plus running season total."
            valueNode={
              <div className="flex w-full items-start justify-between gap-6 text-[10px] uppercase tracking-[0.18em] text-muted-contrast">
                <div className="flex flex-col text-left">
                  <span className="whitespace-nowrap">Trophies Current</span>
                  <span className="text-base font-semibold text-high-contrast tracking-normal">
                    {(member as any).rankedTrophies ?? member.trophies ?? 0}
                  </span>
                </div>
                <div className="flex flex-col text-right items-end">
                  <span className="whitespace-nowrap">Running</span>
                  <span className="text-base font-semibold text-high-contrast tracking-normal">
                    {(member as any).seasonTotalTrophies ?? member.seasonTotalTrophies ?? '—'}
                  </span>
                </div>
              </div>
            }
          />
        </div>
        <StatChip
          label="Rush"
          value={`${rushPercent.toFixed(1)}%`}
          icon={<StatIcon src="/assets/icons/Icon_HV_Resource_Gold_small.png" alt="Rush meter" />}
          tooltip="Rush index vs. max Town Hall levels (higher = more rushed)."
        />
        <StatChip
          label="Donated"
          value={member.donations ?? 0}
          icon={<StatIcon src="/assets/icons/donation.svg" alt="Donations sent" />}
          tone="positive"
          tooltip="Troops donated during the current season."
        />
        <StatChip
          label="Received"
          value={member.donationsReceived ?? 0}
          icon={
            <StatIcon
              src={donations.isNegative ? '/assets/icons/Clan_Castle.png' : '/assets/icons/Donations-seige.png'}
              alt="Donations received"
            />
          }
          tone={donations.isNegative ? 'warning' : 'muted'}
          tooltip={
            donations.isNegative
              ? 'Troops received this season (receiving more than donating).'
              : 'Troops received this season.'
          }
        />
      </div>

      <div className="player-card__hero-section rounded-xl p-3 shadow-inner">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-contrast">Hero Progress</p>
        <div className="space-y-2">
          {(() => {
            const bkAvg = getClanAverage('bk');
            return (
              <HeroLevel 
                hero="BK" 
                level={member.bk || 0} 
                maxLevel={heroCaps.bk || 0} 
                showName={true} 
                size="sm" 
                hideTrackBackground
                clanAverage={bkAvg?.average}
                clanAverageCount={bkAvg?.count}
                clanAverageSource="roster"
              />
            );
          })()}
          {(() => {
            const aqAvg = getClanAverage('aq');
            return (
              <HeroLevel 
                hero="AQ" 
                level={member.aq || 0} 
                maxLevel={heroCaps.aq || 0} 
                showName={true} 
                size="sm" 
                hideTrackBackground
                clanAverage={aqAvg?.average}
                clanAverageCount={aqAvg?.count}
                clanAverageSource="roster"
              />
            );
          })()}
          {(() => {
            const gwAvg = getClanAverage('gw');
            return (
              <HeroLevel 
                hero="GW" 
                level={member.gw || 0} 
                maxLevel={heroCaps.gw || 0} 
                showName={true} 
                size="sm" 
                hideTrackBackground
                clanAverage={gwAvg?.average}
                clanAverageCount={gwAvg?.count}
                clanAverageSource="roster"
              />
            );
          })()}
          {(() => {
            const rcAvg = getClanAverage('rc');
            return (
              <HeroLevel 
                hero="RC" 
                level={member.rc || 0} 
                maxLevel={heroCaps.rc || 0} 
                showName={true} 
                size="sm" 
                hideTrackBackground
                clanAverage={rcAvg?.average}
                clanAverageCount={rcAvg?.count}
                clanAverageSource="roster"
              />
            );
          })()}
          {heroCaps.mp ? (() => {
            const mpAvg = getClanAverage('mp');
            return (
              <HeroLevel 
                hero="MP" 
                level={member.mp || 0} 
                maxLevel={heroCaps.mp || 0} 
                showName={true} 
                size="sm" 
                hideTrackBackground
                clanAverage={mpAvg?.average}
                clanAverageCount={mpAvg?.count}
                clanAverageSource="roster"
              />
            );
          })() : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-contrast">
        <span className="flex items-center gap-1">
          {activity.level === 'Very Active' ? '⚡' : activity.level === 'Inactive' ? '💤' : '🎯'}
          {activity.level}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="player-card__action-button"
          onClick={(event) => {
            event.stopPropagation();
            handleClick();
          }}
        >
          View Detail
        </Button>
      </div>
    </GlassCard>
  );
};

interface StatChipProps {
  label: string;
  value?: number | string;
  valueNode?: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'muted';
  tooltip?: string;
}

function StatChip({ label, value, valueNode, icon, tone = 'default', tooltip }: StatChipProps) {
  const toneClasses = {
    default: 'player-card__chip',
    positive: 'player-card__chip player-card__chip--positive',
    warning: 'player-card__chip player-card__chip--warning',
    muted: 'player-card__chip player-card__chip--muted',
  } as const;

  return (
    <div
      className={`rounded-xl px-2.5 py-1.5 text-xs flex items-center gap-2 shadow-inner ${toneClasses[tone]}`}
      title={tooltip}
    >
      <span className="text-base leading-none flex h-5 w-5 items-center justify-center">{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-contrast">{label}</span>
        {valueNode ? (
          valueNode
        ) : (
          <span className="text-sm font-semibold text-high-contrast">{value}</span>
        )}
      </div>
    </div>
  );
}

const StatIcon = ({ src, alt }: { src: string; alt: string }) => (
  <Image
    src={src}
    alt={alt}
    width={20}
    height={20}
    className="h-5 w-5 object-contain drop-shadow-sm"
  />
);
