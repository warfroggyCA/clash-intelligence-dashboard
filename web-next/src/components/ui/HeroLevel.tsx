import React from 'react';

interface HeroLevelProps {
  hero: 'BK' | 'AQ' | 'GW' | 'RC' | 'MP';
  level: number;
  maxLevel: number;
  className?: string;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
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

const heroConfig = {
  BK: { name: 'Barbarian King', color: 'from-blue-500 to-blue-600' },
  AQ: { name: 'Archer Queen', color: 'from-green-500 to-green-600' },
  GW: { name: 'Grand Warden', color: 'from-purple-500 to-purple-600' },
  RC: { name: 'Royal Champion', color: 'from-red-500 to-red-600' },
  MP: { name: 'Mighty Patroller', color: 'from-yellow-500 to-yellow-600' }
};

export const HeroLevel: React.FC<HeroLevelProps> = ({
  hero,
  level,
  maxLevel,
  className = '',
  showProgress = true,
  size = 'md'
}) => {
  const percentage = maxLevel > 0 ? (level / maxLevel) * 100 : 0;
  const config = heroConfig[hero];
  
  return (
    <div className={`space-y-1 ${className}`}>
      <div className={`flex justify-between ${sizeClasses[size]}`}>
        <span className="text-clash-gold font-semibold">{config.name}</span>
        <span className="text-white">{level}/{maxLevel}</span>
      </div>
      {showProgress && (
        <div className={`w-full bg-black/30 rounded-full ${progressHeightClasses[size]} border border-clash-gold/30 overflow-hidden`}>
          <div 
            className={`bg-gradient-to-r ${config.color} ${progressHeightClasses[size]} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default HeroLevel;
