"use client";

import Image from 'next/image';
import { leagueIconMap, rankedLeagueIconMap, fallbackIcons } from './maps';

interface LeagueIconProps {
  league?: string;
  ranked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  badgeText?: string | number;
  showBadge?: boolean;
}

const sizeMap = { sm: 48, md: 56, lg: 64 };

export const LeagueIcon: React.FC<LeagueIconProps> = ({ league, ranked = false, size = 'md', className = '', badgeText, showBadge }) => {
  const clean = (league || '').trim();
  const map = ranked ? rankedLeagueIconMap : leagueIconMap;
  const src = clean && map[clean] ? map[clean] : fallbackIcons.league;
  const dim = sizeMap[size] || sizeMap.md;
  return (
    <div className={`relative inline-flex ${className}`}>
      <Image
        src={src}
        alt={clean || 'League'}
        width={dim}
        height={dim}
        className="object-contain"
        style={{ width: dim, height: dim }}
      />
      {showBadge && badgeText ? (
        <span
          className="absolute -bottom-1 -right-1 px-1.5 text-[11px] font-bold text-white"
          style={{ textShadow: '0 0 6px rgba(0,0,0,0.8)' }}
        >
          {badgeText}
        </span>
      ) : null}
    </div>
  );
};

export default LeagueIcon;
