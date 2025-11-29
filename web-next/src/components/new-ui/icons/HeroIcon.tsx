"use client";

import Image from 'next/image';
import { heroIconMap, fallbackIcons } from './maps';

interface HeroIconProps {
  hero: 'bk' | 'aq' | 'gw' | 'rc' | 'mp';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap = { sm: 56, md: 72, lg: 84 };

export const HeroIcon: React.FC<HeroIconProps> = ({ hero, size = 'md', className = '', label }) => {
  const src = heroIconMap[hero] || fallbackIcons.hero;
  const dim = sizeMap[size] || sizeMap.md;
  return (
    <Image src={src} alt={label || hero} width={dim} height={dim} className={`object-contain ${className}`} />
  );
};

export default HeroIcon;
