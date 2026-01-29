"use client";

import Image from 'next/image';
import { heroIconMap, fallbackIcons } from './maps';

interface HeroIconProps {
  hero: 'bk' | 'aq' | 'gw' | 'rc' | 'mp';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap = { xs: 40, sm: 56, md: 72, lg: 84 };

export const HeroIcon: React.FC<HeroIconProps> = ({ hero, size = 'md', className = '', label }) => {
  const src = heroIconMap[hero] || fallbackIcons.hero;
  const dim = sizeMap[size] || sizeMap.md;
  return (
    <Image
      src={src}
      alt={label || hero}
      width={dim}
      height={dim}
      className={`object-contain ${className}`}
      style={{ width: dim, height: dim }}
    />
  );
};

export default HeroIcon;
