import React from 'react';

interface HeroLevelProps {
  hero: 'BK' | 'AQ' | 'GW' | 'RC' | 'MP';
  level: number;
  maxLevel: number;
  className?: string;
  showProgress?: boolean;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clanAverage?: number;
}

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

const progressHeightClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
};

const markerSizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3'
};

const heroConfig = {
  BK: { name: 'Barbarian King', color: 'from-blue-500 to-blue-600' },
  AQ: { name: 'Archer Queen', color: 'from-green-500 to-green-600' },
  GW: { name: 'Grand Warden', color: 'from-purple-500 to-purple-600' },
  RC: { name: 'Royal Champion', color: 'from-red-500 to-red-600' },
  MP: { name: 'Minion Prince', color: 'from-yellow-500 to-yellow-600' }
};

export const HeroLevel: React.FC<HeroLevelProps> = ({
  hero,
  level,
  maxLevel,
  className = '',
  showProgress = true,
  showName = true,
  size = 'md',
  clanAverage
}) => {
  const safeLevel = Number.isFinite(level) ? Math.max(level, 0) : 0;
  const safeMax = Number.isFinite(maxLevel) ? Math.max(maxLevel, 0) : 0;
  const percentage = safeMax > 0 ? (safeLevel / safeMax) * 100 : 0;
  const config = heroConfig[hero];
  const hasAverage = typeof clanAverage === 'number' && Number.isFinite(clanAverage);
  const clampedAverage = hasAverage ? Math.min(Math.max(clanAverage!, 0), safeMax) : null;
  const averagePercentage = hasAverage && safeMax > 0 && clampedAverage !== null
    ? (clampedAverage / safeMax) * 100
    : null;
  
  return (
    <div className={`space-y-1 ${className}`}>
      <div className={`flex justify-between ${sizeClasses[size]}`}>
        {showName && <span className="text-clash-gold font-semibold">{config.name}</span>}
        <span className="text-high-contrast">{safeLevel}/{safeMax}</span>
      </div>
      {showProgress && (
        <div className={`hero-progress-track relative w-full rounded-full ${progressHeightClasses[size]} overflow-hidden`}>
          <div 
            className={`bg-gradient-to-r ${config.color} ${progressHeightClasses[size]} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          {averagePercentage !== null ? (
            <span
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900/80 bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.75)] ${markerSizeClasses[size]}`}
              style={{ left: `${averagePercentage}%` }}
              title={`Clan average ${clanAverage?.toFixed(1) ?? ''}`}
              aria-hidden="true"
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default HeroLevel;
