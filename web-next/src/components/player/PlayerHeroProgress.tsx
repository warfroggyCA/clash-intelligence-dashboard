'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { HeroLevel } from '@/components/ui';
import type { PlayerHeroProgressItem } from '@/lib/player-profile';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { Member } from '@/types';

interface PlayerHeroProgressProps {
  heroes: PlayerHeroProgressItem[];
}

type HeroShortLabel = PlayerHeroProgressItem['shortLabel'];

const EMPTY_MEMBERS: Member[] = [];
const HERO_SHORT_LABELS: HeroShortLabel[] = ['BK', 'AQ', 'GW', 'RC', 'MP'];
const HERO_FIELD_MAP: Record<HeroShortLabel, keyof Pick<Member, 'bk' | 'aq' | 'gw' | 'rc' | 'mp'>> = {
  BK: 'bk',
  AQ: 'aq',
  GW: 'gw',
  RC: 'rc',
  MP: 'mp',
};
const HERO_ICON_MAP: Record<HeroShortLabel, { src: string; alt: string }> = {
  BK: { src: '/assets/heroes/Barbarian_King.png', alt: 'Barbarian King' },
  AQ: { src: '/assets/heroes/Archer_Queen.png', alt: 'Archer Queen' },
  GW: { src: '/assets/heroes/Grand_Warden.png', alt: 'Grand Warden' },
  RC: { src: '/assets/heroes/Royal_Champion.png', alt: 'Royal Champion' },
  MP: { src: '/assets/heroes/Minion_Prince.png', alt: 'Minion Prince' },
};

export const PlayerHeroProgress: React.FC<PlayerHeroProgressProps> = ({ heroes }) => {
  const rosterMembers = useDashboardStore((state) => state.roster?.members ?? EMPTY_MEMBERS);

  const clanHeroAverages = useMemo<Partial<Record<HeroShortLabel, number>>>(() => {
    if (!rosterMembers.length) {
      return {};
    }

    const totals: Record<HeroShortLabel, { sum: number; count: number }> = {
      BK: { sum: 0, count: 0 },
      AQ: { sum: 0, count: 0 },
      GW: { sum: 0, count: 0 },
      RC: { sum: 0, count: 0 },
      MP: { sum: 0, count: 0 },
    };

    rosterMembers.forEach((member) => {
      HERO_SHORT_LABELS.forEach((label) => {
        const field = HERO_FIELD_MAP[label];
        const value = member[field];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
          totals[label].sum += value;
          totals[label].count += 1;
        }
      });
    });

    const averages: Partial<Record<HeroShortLabel, number>> = {};

    HERO_SHORT_LABELS.forEach((label) => {
      const { sum, count } = totals[label];
      if (count > 0) {
        averages[label] = sum / count;
      }
    });

    return averages;
  }, [rosterMembers]);

  const hasClanAverages = HERO_SHORT_LABELS.some((label) => typeof clanHeroAverages[label] === 'number');

  if (!heroes.length) {
    return <p className="text-sm text-muted-contrast">No heroes unlocked yet.</p>;
  }

  return (
    <div className="space-y-3">
      {heroes.map((hero) => {
        const shortLabel = hero.shortLabel;
        const icon = HERO_ICON_MAP[shortLabel];
        return (
          <div key={hero.shortLabel} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            {icon ? (
              <div className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-2 shadow-[0_12px_22px_-14px_rgba(8,15,31,0.8)]">
                <Image
                  src={icon.src}
                  alt={icon.alt}
                  width={72}
                  height={72}
                  className="h-16 w-16 object-contain"
                  priority
                />
              </div>
            ) : null}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-sm text-medium-contrast">
                <span className="font-semibold">{hero.hero}</span>
                <span className="font-mono text-xs text-muted-contrast">
                  {hero.level}/{hero.maxLevel}
                </span>
              </div>
              <HeroLevel
                hero={shortLabel}
                level={hero.level}
                maxLevel={hero.maxLevel}
                showName={false}
                size="md"
                clanAverage={clanHeroAverages[shortLabel]}
              />
              {hero.upgrading ? (
                <p className="text-xs text-muted-contrast">
                  Upgrading to {hero.upgrading.targetLevel}
                  {hero.upgrading.completeAt
                    ? ` • completes ${Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(hero.upgrading.completeAt))}`
                    : ''}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      {hasClanAverages ? (
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-contrast">
          <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-slate-900/80 bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.75)]" aria-hidden="true" />
          <span>Clan average marker</span>
        </div>
      ) : null}
    </div>
  );
};

export default PlayerHeroProgress;
