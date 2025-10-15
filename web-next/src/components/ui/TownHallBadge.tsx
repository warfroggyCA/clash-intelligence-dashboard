import React from 'react';
import Image from 'next/image';

interface TownHallBadgeProps {
  level: number;
  className?: string;
  showLevel?: boolean;
  showBox?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  levelBadgeClassName?: string;
}

const sizePixels: Record<'sm' | 'md' | 'lg' | 'xl', number> = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
};

const textSizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export const TownHallBadge: React.FC<TownHallBadgeProps> = ({
  level,
  className = '',
  showLevel = true,
  showBox = true,
  size = 'md',
  levelBadgeClassName = ''
}) => {
  const safeLevel = Math.max(1, Number(level) || 1);
  const thImage = `/assets/clash/Townhalls/TH${safeLevel}.png`;
  const dimension = sizePixels[size];
  const hasCustomLevelStyles = Boolean(levelBadgeClassName.trim());
  const baseLevelBadgeClasses =
    'rounded-full border border-brand-border/70 bg-brand-accent px-1.5 text-center font-semibold text-brand-surface shadow-md';
  const levelBadgeClasses = hasCustomLevelStyles
    ? levelBadgeClassName
    : `${baseLevelBadgeClasses} ${textSizeClasses[size]}`;
  const levelBadgeStyle = hasCustomLevelStyles ? undefined : { minWidth: '1.4em' };
  
  if (!showBox) {
    return (
      <div
        className={`relative inline-block ${className}`}
        style={{ width: `${dimension}px`, height: `${dimension}px` }}
      >
        <Image
          src={thImage}
          alt={`Town Hall ${level}`}
          width={dimension}
          height={dimension}
          className="object-contain"
          style={{ width: `${dimension}px`, height: `${dimension}px` }}
          onError={(e) => {
            // Fallback to emoji if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `🏰`;
              parent.className += ' flex items-center justify-center text-clash-gold';
            }
          }}
        />
        {showLevel && (
          <span
            className={`absolute -bottom-1 -right-1 ${levelBadgeClasses}`}
            style={levelBadgeStyle}
          >
            {level}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ width: `${dimension}px`, height: `${dimension}px` }}
      >
        <Image
          src={thImage}
          alt={`Town Hall ${level}`}
          width={dimension}
          height={dimension}
          className="object-cover"
          style={{ width: `${dimension}px`, height: `${dimension}px` }}
          onError={(e) => {
            // Fallback to emoji if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `🏰`;
              parent.className += ' flex items-center justify-center text-clash-gold';
            }
          }}
        />
      </div>
      {showLevel && (
        <span
          className={`absolute -bottom-1 -right-1 ${levelBadgeClasses}`}
          style={levelBadgeStyle}
        >
          {level}
        </span>
      )}
    </div>
  );
};

export default TownHallBadge;
