"use client";

import React from 'react';
import { Member } from '@/types';
import { TownHallBadge, LeagueBadge, HeroLevel, Button, GlassCard } from '@/components/ui';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  calculateActivityScore,
  getTownHallLevel,
} from '@/lib/business/calculations';
import { HERO_MAX_LEVELS } from '@/types';
import { getRoleBadgeVariant } from '@/lib/leadership';

interface PlayerCardProps {
  member: Member;
  onSelect?: (member: Member) => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ member, onSelect }) => {
  const rushPercent = calculateRushPercentage(member);
  const donations = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const th = getTownHallLevel(member);
  const heroCaps = HERO_MAX_LEVELS[th] || {};
  const roleVariant = getRoleBadgeVariant(member.role);
  const showRoleBadge = roleVariant.tone !== 'member';

  const handleClick = () => {
    onSelect?.(member);
  };

  return (
    <GlassCard
      className={`player-card relative flex flex-col gap-4 p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl ${
        rushPercent >= 70 ? 'ring-2 ring-rose-400/50' : rushPercent >= 40 ? 'ring-2 ring-amber-300/40' : 'ring-1 ring-emerald-300/30'
      }`}
      role="button"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-medium-contrast">
            <TownHallBadge level={th} size="md" />
            {showRoleBadge ? (
              <span className={`role-badge role-badge--${roleVariant.tone} inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold`}
              >
                {roleVariant.icon && <span aria-hidden className="text-xs">{roleVariant.icon}</span>}
                <span className="role-badge__label">{roleVariant.label}</span>
              </span>
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-muted-contrast">Member</span>
            )}
          </div>
          <h3 className="text-xl font-semibold text-high-contrast drop-shadow-sm">{member.name}</h3>
          <div className="text-xs text-muted-contrast">{member.tag}</div>
        </div>
        <LeagueBadge trophies={member.trophies || 0} size="lg" showText={false} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatChip label="Trophies" value={member.trophies ?? 0} icon="🏆" />
        <StatChip label="Rush" value={`${rushPercent.toFixed(1)}%`} icon={rushPercent >= 70 ? '🔥' : rushPercent >= 40 ? '⚠️' : '✅'} />
        <StatChip label="Donated" value={member.donations ?? 0} icon="💝" tone="positive" />
        <StatChip
          label="Received"
          value={member.donationsReceived ?? 0}
          icon={donations.isNegative ? '📥' : '📤'}
          tone={donations.isNegative ? 'warning' : 'muted'}
        />
      </div>

      <div className="player-card__hero-section rounded-xl p-3 shadow-inner">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-contrast">Hero Progress</p>
        <div className="space-y-2">
          <HeroLevel hero="BK" level={member.bk || 0} maxLevel={heroCaps.bk || 0} showName={false} size="sm" />
          <HeroLevel hero="AQ" level={member.aq || 0} maxLevel={heroCaps.aq || 0} showName={false} size="sm" />
          <HeroLevel hero="GW" level={member.gw || 0} maxLevel={heroCaps.gw || 0} showName={false} size="sm" />
          <HeroLevel hero="RC" level={member.rc || 0} maxLevel={heroCaps.rc || 0} showName={false} size="sm" />
          {heroCaps.mp ? (
            <HeroLevel hero="MP" level={member.mp || 0} maxLevel={heroCaps.mp || 0} showName={false} size="sm" />
          ) : null}
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
  value: number | string;
  icon: string;
  tone?: 'default' | 'positive' | 'warning' | 'muted';
}

function StatChip({ label, value, icon, tone = 'default' }: StatChipProps) {
  const toneClasses = {
    default: 'player-card__chip',
    positive: 'player-card__chip player-card__chip--positive',
    warning: 'player-card__chip player-card__chip--warning',
    muted: 'player-card__chip player-card__chip--muted',
  } as const;

  return (
    <div className={`rounded-xl px-3 py-2 text-sm flex flex-col gap-1 shadow-inner ${toneClasses[tone]}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-contrast">{label}</span>
      <span className="text-base font-semibold flex items-center gap-1 text-high-contrast">
        <span>{icon}</span> {value}
      </span>
    </div>
  );
}
