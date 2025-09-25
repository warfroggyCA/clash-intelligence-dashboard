"use client";

import { useEffect } from 'react';
import { Member } from '@/types';
import { Button, HeroLevel, LeagueBadge, TownHallBadge } from '@/components/ui';
import {
  calculateRushPercentage,
  calculateDonationBalance,
  calculateActivityScore,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
} from '@/lib/business/calculations';
import { HERO_MAX_LEVELS } from '@/types';

interface PlayerDetailDrawerProps {
  member: Member | null;
  onClose: () => void;
}

export function PlayerDetailDrawer({ member, onClose }: PlayerDetailDrawerProps) {
  useEffect(() => {
    if (member) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }
  }, [member]);

  if (!member) return null;

  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donations = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const heroCaps = HERO_MAX_LEVELS[th] || {};

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/50">
              <TownHallBadge level={th} size="sm" />
              {member.role}
            </div>
            <h2 className="mt-2 text-2xl font-semibold drop-shadow-sm">{member.name}</h2>
            <div className="text-xs text-white/60">{member.tag}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LeagueBadge trophies={member.trophies || 0} size="lg" showText={false} />
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70">
              Close
            </Button>
          </div>
        </header>

        <section className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Trophies" value={member.trophies ?? 0} icon="🏆" />
            <Stat label="Donated" value={member.donations ?? 0} icon="💝" tone="positive" />
            <Stat label="Received" value={member.donationsReceived ?? 0} icon="📥" tone={donations.isNegative ? 'warning' : 'muted'} />
            <Stat label="Rush" value={`${rushPercent.toFixed(1)}%`} icon={isVeryRushed(member) ? '🔥' : isRushed(member) ? '⚠️' : '✅'} />
          </div>
        </section>

        <section className="border-t border-b border-white/5 bg-white/5 px-6 py-5">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Hero Progress</h3>
          <div className="mt-3 space-y-3">
            <HeroLevel hero="BK" level={member.bk || 0} maxLevel={heroCaps.bk || 0} size="md" />
            <HeroLevel hero="AQ" level={member.aq || 0} maxLevel={heroCaps.aq || 0} size="md" />
            <HeroLevel hero="GW" level={member.gw || 0} maxLevel={heroCaps.gw || 0} size="md" />
            <HeroLevel hero="RC" level={member.rc || 0} maxLevel={heroCaps.rc || 0} size="md" />
            {heroCaps.mp ? <HeroLevel hero="MP" level={member.mp || 0} maxLevel={heroCaps.mp || 0} size="md" /> : null}
          </div>
        </section>

        <section className="px-6 py-5 space-y-4 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Activity</p>
            <p className="text-base font-semibold flex items-center gap-2">
              {activity.level}
              <span className="text-xs font-normal text-white/60">Score {activity.score?.toFixed?.(1) ?? activity.score}</span>
            </p>
            {activity.description && (
              <p className="mt-2 text-white/60 text-xs leading-relaxed">{activity.description}</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
            <p className="text-xs uppercase tracking-widest text-white/50">Donation Summary</p>
            <div className="flex items-center justify-between text-white/80">
              <span>Given</span>
              <span>{(member.donations ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-white/80">
              <span>Received</span>
              <span>{(member.donationsReceived ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Net</span>
              <span className={donations.balance >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                {donations.balance >= 0 ? '+' : '-'}{Math.abs(donations.balance).toLocaleString()}
              </span>
            </div>
          </div>

          {member.notes && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Notes</p>
              <p className="text-white/80 text-sm leading-relaxed">{member.notes}</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function Stat({ label, value, icon, tone = 'default' }: { label: string; value: number | string; icon: string; tone?: 'default' | 'positive' | 'warning' | 'muted' }) {
  const toneClasses = {
    default: 'bg-white/10 text-white',
    positive: 'bg-emerald-400/15 text-emerald-200',
    warning: 'bg-amber-400/15 text-amber-200',
    muted: 'bg-white/5 text-white/70',
  };

  return (
    <div className={`rounded-xl px-3 py-2 shadow-inner ${toneClasses[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      <p className="mt-1 text-base font-semibold flex items-center gap-2">
        <span>{icon}</span> {value}
      </p>
    </div>
  );
}
