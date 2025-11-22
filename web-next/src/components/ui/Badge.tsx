"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { MetricBar } from './MetricBar';

export type BadgeTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeProps {
  label: string;
  description?: string;
  tier?: BadgeTier;
  icon?: React.ReactNode;
  progress?: number;
  goal?: number;
  xp?: number;
  earnedAt?: string;
  className?: string;
}

const tierAccent: Record<BadgeTier, string> = {
  common: 'from-slate-500/40 via-slate-700/30 to-slate-900/40 border-white/10',
  rare: 'from-blue-500/30 via-indigo-600/20 to-slate-900/40 border-blue-400/30',
  epic: 'from-purple-500/40 via-pink-500/20 to-slate-900/40 border-purple-400/30',
  legendary: 'from-amber-400/40 via-orange-500/30 to-slate-900/60 border-amber-300/40',
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  description,
  tier = 'common',
  icon,
  progress,
  goal,
  xp,
  earnedAt,
  className = '',
}) => {
  const clampedGoal = goal && goal > 0 ? goal : undefined;
  const progressValue = typeof progress === 'number' ? progress : undefined;
  const percentage =
    clampedGoal && typeof progressValue === 'number'
      ? Math.min(Math.max(progressValue / clampedGoal, 0), 1) * 100
      : undefined;
  const isComplete = typeof percentage === 'number' && percentage >= 100;

  return (
    <div
      className={cn(
        'badge-card relative flex flex-col gap-3 rounded-2xl border bg-gradient-to-br px-4 py-4 text-white shadow-[0_12px_30px_-25px_rgba(7,9,14,0.8)]',
        tierAccent[tier],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl text-white">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.35em] text-slate-300">{tier}</div>
          <h4
            className="text-xl font-semibold text-white"
            style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {label}
          </h4>
          {description && <p className="text-sm text-slate-300">{description}</p>}
        </div>
      </div>

      {typeof percentage === 'number' && (
        <div className="space-y-1 text-xs text-slate-300">
          <MetricBar
            label="Progress"
            value={percentage}
            max={100}
            tone={tier === 'legendary' ? 'warning' : tier === 'epic' ? 'info' : 'neutral'}
            showValue={false}
            variant="candlestick"
          />
          <div className="flex justify-between text-[11px] uppercase tracking-[0.3em]">
            <span>{isComplete ? 'Unlocked' : progressValue}</span>
            <span>{isComplete ? 'Complete' : `Goal ${clampedGoal}`}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          {xp ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[11px] uppercase tracking-[0.3em]">
              +{xp} XP
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.3em] text-emerald-200">
              Complete
            </span>
          )}
        </div>
        {earnedAt && <span className="text-slate-400">Since {earnedAt}</span>}
      </div>
    </div>
  );
};

export default Badge;
