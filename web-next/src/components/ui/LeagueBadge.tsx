import React from 'react';
import Image from 'next/image';

interface LeagueBadgeProps {
  league: string;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

const containerSizeClasses = {
  sm: 'px-2 py-1',
  md: 'px-3 py-1',
  lg: 'px-4 py-2'
};

export const LeagueBadge: React.FC<LeagueBadgeProps> = ({
  league,
  className = '',
  showText = true,
  size = 'md'
}) => {
  // Map league names to image filenames
  const leagueImageMap: Record<string, string> = {
    'Bronze': 'Bronze.png',
    'Bronze League': 'Bronze.png',
    'Bronze League I': 'Bronze.png',
    'Bronze League II': 'Bronze.png',
    'Bronze League III': 'Bronze.png',
    'Silver': 'Silver.png',
    'Silver League': 'Silver.png',
    'Silver League I': 'Silver.png',
    'Silver League II': 'Silver.png',
    'Silver League III': 'Silver.png',
    'Gold': 'Gold.png',
    'Gold League': 'Gold.png',
    'Gold League I': 'Gold.png',
    'Gold League II': 'Gold.png',
    'Gold League III': 'Gold.png',
    'Crystal': 'Crystal.png',
    'Crystal League': 'Crystal.png',
    'Crystal League I': 'Crystal.png',
    'Crystal League II': 'Crystal.png',
    'Crystal League III': 'Crystal.png',
    'Master': 'Master.png',
    'Master League': 'Master.png',
    'Master League I': 'Master.png',
    'Master League II': 'Master.png',
    'Master League III': 'Master.png',
    'Champion': 'Champion.png',
    'Champion League': 'Champion.png',
    'Champion League I': 'Champion.png',
    'Champion League II': 'Champion.png',
    'Champion League III': 'Champion.png',
    'Titan': 'Titan.png',
    'Titan League': 'Titan.png',
    'Titan League I': 'Titan.png',
    'Titan League II': 'Titan.png',
    'Titan League III': 'Titan.png',
    'Legend': 'Legend.png',
    'Legend League': 'Legend.png',
    'Legend League I': 'Legend.png',
    'Legend League II': 'Legend.png',
    'Legend League III': 'Legend.png',
    'Legend League IV': 'Legend.png',
  };

  const leagueImage = leagueImageMap[league] || 'Bronze.png';
  const imagePath = `/assets/clash/Leagues/${leagueImage}`;
  
  return (
    <div className={`flex items-center gap-2 bg-gradient-to-r from-clash-gold/20 to-clash-orange/20 border border-clash-gold/30 rounded-lg ${containerSizeClasses[size]} ${className}`}>
      <Image
        src={imagePath}
        alt={`${league} League`}
        width={20}
        height={20}
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          // Fallback to trophy emoji if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `🏆`;
            parent.className += ' flex items-center justify-center text-clash-gold';
          }
        }}
      />
      {showText && (
        <span className={`text-clash-gold font-semibold ${textSizeClasses[size]}`}>
          {league}
        </span>
      )}
    </div>
  );
};

export default LeagueBadge;
