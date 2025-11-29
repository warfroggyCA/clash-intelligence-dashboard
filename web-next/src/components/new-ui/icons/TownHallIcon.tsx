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
          className="absolute -bottom-1 -right-1 px-1.5 text-[11px] font-bold text-white"
          style={{
            textShadow: '0 0 6px rgba(0,0,0,0.8)',
          }}
        >
          {level}
        </span>
      ) : null}
    </div>
  );
};

export default TownHallIcon;
