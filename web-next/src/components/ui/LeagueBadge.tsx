import React from 'react';
import Image from 'next/image';

interface LeagueBadgeProps {
  league?: string;
  trophies?: number;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  tier?: number; // optional, reserved for future use
}

const imageDimensions = {
  sm: { width: 20, height: 20 },
  md: { width: 24, height: 24 },
  lg: { width: 32, height: 32 },
  xl: { width: 96, height: 96 },
  xxl: { width: 128, height: 128 }
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
  xxl: 'text-xl'
};

const containerSizeClasses = {
  sm: 'px-2 py-1',
  md: 'px-3 py-1',
  lg: 'px-4 py-2',
  xl: 'px-6 py-3',
  xxl: 'px-8 py-4'
};

// Helper function to determine league based on trophy count (legacy/battle mode)
const getLeagueFromTrophies = (trophies: number): string => {
  if (trophies >= 5000) return 'Legend';
  if (trophies >= 4000) return 'Titan';
  if (trophies >= 3000) return 'Champion';
  if (trophies >= 2000) return 'Master';
  if (trophies >= 1400) return 'Crystal';
  if (trophies >= 800) return 'Gold';
  if (trophies >= 400) return 'Silver';
  return 'Bronze';
};

// Oct 2025 ranked league names present in new asset set
const OCT2025_CANON: Record<string, string> = {
  'barbarian league': 'Barbarian League',
  'archer league': 'Archer League',
  'wizard league': 'Wizard League',
  'witch league': 'Witch League',
  'valkyrie league': 'Valkyrie League',
  'golem league': 'Golem League',
  'pekka league': 'PEKKA League',
  'dragon league': 'Dragon League',
  'electro league': 'Electro League',
  'skeleton league': 'Skeleton League',
  'titan league': 'Titan League',
  'legend league': 'Legend League',
};

const toOct2025ImagePath = (name: string): string => {
  // Map "Barbarian League" -> "/assets/Oct2025%20Leagues/Barbarian_League.png"
  const file = `${name.replace(/\s+/g, '_')}.png`;
  // Keep directory with space; browsers will request "%20" automatically
  return `/assets/Oct2025 Leagues/${file}`;
};

export const LeagueBadge: React.FC<LeagueBadgeProps> = ({
  league,
  trophies,
  className = '',
  showText = true,
  size = 'md',
  tier,
}) => {
  // Determine league name
  const cleanedLeagueName = typeof league === 'string' ? league.trim() : '';
  const hasNamedLeague = cleanedLeagueName.length > 0;
  const determinedLeague = hasNamedLeague
    ? cleanedLeagueName
    : trophies !== undefined && trophies !== null
      ? getLeagueFromTrophies(trophies)
      : 'No League';
  // Normalize to base league (strip trailing numeric/roman tier)
  const m = determinedLeague.match(/^(.*?League)(?:\s+(\d+|[IVXLCDM]+))?$/i);
  const baseLeague = m ? m[1] : determinedLeague;
  const parsedTier = (() => {
    const raw = m?.[2];
    if (!raw) return undefined;
    if (/^\d+$/.test(raw)) return Number(raw);
    const map: Record<string, number> = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
    let total = 0, prev = 0; const s = raw.toUpperCase();
    for (let i = s.length - 1; i >= 0; i--) { const val = map[s[i]]||0; total += val < prev ? -val : val; prev = val; }
    return total || undefined;
  })();
  
  // Legacy league image filenames (pre-Oct 2025)
  const legacyImageMap: Record<string, string> = {
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
    'No League': 'No_League.png',
    'Unranked': 'No_League.png',
  };

  // Choose asset set: prefer new Oct 2025 images if the league name matches known set
  const baseKey = baseLeague.toLowerCase();
  const canonBase = OCT2025_CANON[baseKey];
  const isOct2025 = Boolean(canonBase);
  const altLabel = determinedLeague.includes('League') ? determinedLeague : `${determinedLeague} League`;
  const imagePath = isOct2025
    ? toOct2025ImagePath(canonBase!)
    : `/assets/clash/Leagues/${legacyImageMap[baseLeague] || 'Bronze.png'}`;
  
  if (!showText) {
    // Just return the image without the background box
    const dimensions = imageDimensions[size];
    return (
      <div className={`relative inline-block ${className}`} style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}>
        <Image
          src={imagePath}
          alt={altLabel}
          width={dimensions.width}
          height={dimensions.height}
          className="object-contain"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
          quality={100}
          priority={size === 'xxl'}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `🏆`;
              parent.className += ' flex items-center justify-center text-clash-gold';
            }
          }}
        />
        {(tier ?? parsedTier) ? (
          <span className="absolute -bottom-1 -right-1 rounded-full border border-black/20 bg-black/70 px-1.5 text-[10px] font-semibold text-white shadow-md">
            {tier ?? parsedTier}
          </span>
        ) : null}
      </div>
    );
  }

  const dimensions = imageDimensions[size];
  return (
    <div className={`flex items-center gap-2 bg-gradient-to-r from-clash-gold/20 to-clash-orange/20 border border-clash-gold/30 rounded-lg ${containerSizeClasses[size]} ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}>
        <Image
          src={imagePath}
          alt={altLabel}
          width={dimensions.width}
          height={dimensions.height}
          className="object-contain"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
          quality={100}
          priority={size === 'xxl'}
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
        {(tier ?? parsedTier) ? (
          <span className="absolute -bottom-1 -right-1 rounded-full border border-black/20 bg-black/70 px-1.5 text-[10px] font-semibold text-white shadow-md">
            {tier ?? parsedTier}
          </span>
        ) : null}
      </div>
      <span className={`text-clash-gold font-semibold ${textSizeClasses[size]}`}>
        {determinedLeague}
      </span>
    </div>
  );
};

export default LeagueBadge;
