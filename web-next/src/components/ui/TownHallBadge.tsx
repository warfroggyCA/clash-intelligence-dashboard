import React from 'react';
import Image from 'next/image';

interface TownHallBadgeProps {
  level: number;
  className?: string;
  showLevel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20'
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg'
};

export const TownHallBadge: React.FC<TownHallBadgeProps> = ({
  level,
  className = '',
  showLevel = true,
  size = 'md'
}) => {
  const thImage = `/assets/clash/Townhalls/TH${level}.png`;
  
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-lg flex items-center justify-center overflow-hidden`}>
        <Image
          src={thImage}
          alt={`Town Hall ${level}`}
          width={size === 'sm' ? 48 : size === 'md' ? 64 : 80}
          height={size === 'sm' ? 48 : size === 'md' ? 64 : 80}
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
        <span className={`absolute -bottom-1 -right-1 bg-clash-gold text-black ${textSizeClasses[size]} font-bold px-1.5 rounded-full min-w-[1.4em] text-center border border-black/20`}>
          {level}
        </span>
      )}
    </div>
  );
};

export default TownHallBadge;
