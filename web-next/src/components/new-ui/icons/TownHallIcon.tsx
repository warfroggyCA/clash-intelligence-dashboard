"use client";

import Image from 'next/image';
import { townHallIconMap, fallbackIcons } from './maps';

interface TownHallIconProps {
  level?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  alt?: string;
  showBadge?: boolean;
}

const sizeMap = {
  sm: 36,
  md: 48,
  lg: 64,
};

export const TownHallIcon: React.FC<TownHallIconProps> = ({ level, size = 'md', className = '', alt, showBadge = true }) => {
  const src = level && townHallIconMap[level] ? townHallIconMap[level] : fallbackIcons.townHall;
  const dim = sizeMap[size] || sizeMap.md;
  return (
    <div className={`relative inline-flex ${className}`}>
      <Image
        src={src}
        alt={alt || (level ? `Town Hall ${level}` : 'Town Hall')}
        width={dim}
        height={dim}
        className="object-contain"
        style={{ width: dim, height: dim }}
        priority
      />
      {showBadge && typeof level === 'number' ? (
        <span
          className="absolute -bottom-1 -right-1 h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
          style={{
            background: 'var(--badge-bg, rgba(0,0,0,0.70))',
            color: 'var(--badge-fg, rgba(255,255,255,0.92))',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.16))',
          }}
        >
          {level}
        </span>
      ) : null}
    </div>
  );
};

export default TownHallIcon;
