"use client";

import Image from 'next/image';
import { parseRankedLeagueName } from '@/lib/league-tiers';
import { leagueIconMap, rankedLeagueIconMap, fallbackIcons } from './maps';

interface LeagueIconProps {
  league?: string;
  ranked?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  badgeText?: string | number;
  showBadge?: boolean;
}

const sizeMap = { xs: 36, sm: 48, md: 56, lg: 64 };

export const LeagueIcon: React.FC<LeagueIconProps> = ({ league, ranked = false, size = 'md', className = '', badgeText, showBadge }) => {
  const clean = (league || '').trim();
  const map = ranked ? rankedLeagueIconMap : leagueIconMap;
  const normalizeKey = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const resolveKey = () => {
    if (!clean) return '';
    let normalized = clean;
    if (ranked) {
      const cleaned = clean.replace(/\./g, '');
      const parsed = parseRankedLeagueName(cleaned);
      if (parsed?.baseName) {
        normalized = parsed.baseName;
      }
    }
    if (map[normalized]) return normalized;
    const lower = normalized.toLowerCase();
    const match = Object.keys(map).find((key) => key.toLowerCase() === lower);
    if (match) return match;
    const normalizedKey = normalizeKey(normalized);
    const matchNormalized = Object.keys(map).find(
      (key) => normalizeKey(key) === normalizedKey,
    );
    return matchNormalized ?? normalized;
  };
  const key = resolveKey();
  const src = key && map[key] ? map[key] : fallbackIcons.league;
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
          className="absolute -bottom-1 -right-1 h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
          style={{
            background: 'var(--badge-bg, rgba(0,0,0,0.70))',
            color: 'var(--badge-fg, rgba(255,255,255,0.92))',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.16))',
          }}
        >
          {badgeText}
        </span>
      ) : null}
    </div>
  );
};

export default LeagueIcon;
