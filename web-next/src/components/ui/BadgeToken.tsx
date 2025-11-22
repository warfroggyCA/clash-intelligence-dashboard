"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';

export type BadgeTokenTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeTokenProps {
  label: string;
  tier?: BadgeTokenTier;
  icon?: React.ReactNode;
  earned?: boolean;
  description?: string;
  className?: string;
}

const tokenStyles: Record<BadgeTokenTier, string> = {
  common: 'border-white/20 text-slate-200 bg-white/5',
  rare: 'border-blue-400/40 text-blue-100 bg-gradient-to-br from-blue-600/40 to-slate-900/60',
  epic: 'border-purple-400/50 text-purple-100 bg-gradient-to-br from-purple-600/40 to-slate-900/60',
  legendary: 'border-amber-300/60 text-amber-100 bg-gradient-to-br from-amber-400/40 to-orange-500/30',
};

export const BadgeToken: React.FC<BadgeTokenProps> = ({
  label,
  tier = 'common',
  icon,
  earned = true,
  description,
  className = '',
}) => {
  const content = (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-opacity',
        tokenStyles[tier],
        !earned && 'opacity-40',
        className,
      )}
      style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", system-ui, sans-serif' }}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span className="truncate">{label}</span>
    </div>
  );

  if (description) {
    return (
      <Tooltip content={description} position="top">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default BadgeToken;
