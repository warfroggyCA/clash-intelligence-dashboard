import React from 'react';
import Image from 'next/image';

interface TownHallBadgeProps {
  level: number;
  className?: string;
  showLevel?: boolean;
  showBox?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
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
  size = 'md'
}) => {
  const thImage = `/assets/clash/Townhalls/TH${level}.png`;
  
  if (!showBox) {
    return (
      <div className={`relative ${className}`}>
        <Image
          src={thImage}
          alt={`Town Hall ${level}`}
          width={size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : 96}
          height={size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : 96}
          className={`${sizeClasses[size]} object-contain`}
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
            className={`absolute -bottom-1 -right-1 rounded-full border border-brand-border/70 bg-brand-accent px-1.5 text-center font-semibold text-brand-surface ${textSizeClasses[size]} shadow-md`}
            style={{ minWidth: '1.4em' }}
          >
            {level}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-lg flex items-center justify-center overflow-hidden`}>
        <Image
          src={thImage}
          alt={`Town Hall ${level}`}
          width={size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : 96}
          height={size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : 96}
          className="object-cover"
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
          className={`absolute -bottom-1 -right-1 rounded-full border border-brand-border/70 bg-brand-accent px-1.5 text-center font-semibold text-brand-surface ${textSizeClasses[size]} shadow-md`}
          style={{ minWidth: '1.4em' }}
        >
          {level}
        </span>
      )}
    </div>
  );
};

export default TownHallBadge;
