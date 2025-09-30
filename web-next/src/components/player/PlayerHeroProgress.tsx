'use client';

import React from 'react';
import { HeroLevel } from '@/components/ui';
import { PlayerHeroProgressItem } from '@/lib/player-profile';

interface PlayerHeroProgressProps {
  heroes: PlayerHeroProgressItem[];
}

export const PlayerHeroProgress: React.FC<PlayerHeroProgressProps> = ({ heroes }) => {
  if (!heroes.length) {
    return <p className="text-sm text-muted-contrast">No heroes unlocked yet.</p>;
  }

  return (
    <div className="space-y-3">
      {heroes.map((hero) => (
        <div key={hero.shortLabel} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-medium-contrast">
            <span className="font-semibold">{hero.hero}</span>
            <span className="font-mono text-xs text-muted-contrast">
              {hero.level}/{hero.maxLevel}
            </span>
          </div>
          <HeroLevel
            hero={hero.shortLabel as any}
            level={hero.level}
            maxLevel={hero.maxLevel}
            showName={false}
            size="md"
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
      ))}
    </div>
  );
};

export default PlayerHeroProgress;
