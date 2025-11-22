"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export type MetricBarTone =
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export interface MetricBarProps {
  label: React.ReactNode;
  value: number;
  max?: number;
  min?: number;
  valueLabel?: React.ReactNode;
  helperText?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MetricBarTone;
  targetValue?: number;
  targetLabel?: React.ReactNode;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  size?: 'sm' | 'md';
  showValue?: boolean;
  variant?: 'solid' | 'outlined' | 'minimal' | 'candlestick';
}

const toneClasses: Record<MetricBarTone, string> = {
  brand: 'from-clash-gold to-orange-400',
  info: 'from-blue-500 to-indigo-500',
  success: 'from-emerald-500 to-lime-500',
  warning: 'from-amber-500 to-orange-500',
  danger: 'from-rose-500 to-red-500',
  neutral: 'from-slate-400 to-slate-500',
};

const heightMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

export const MetricBar: React.FC<MetricBarProps> = ({
  label,
  value,
  max = 100,
  min = 0,
  valueLabel,
  helperText,
  icon,
  tone = 'brand',
  targetValue,
  targetLabel,
  className = '',
  trackClassName = '',
  barClassName = '',
  size = 'md',
  showValue = true,
  variant = 'solid',
}) => {
  const safeMin = Number.isFinite(min) ? Number(min) : 0;
  const safeMax = Number.isFinite(max) ? Number(max) : 0;
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  const range = safeMax - safeMin || 1;
  const percentage = Math.min(Math.max((safeValue - safeMin) / range, 0), 1) * 100;
  const targetPercentage =
    Number.isFinite(targetValue) && safeMax !== safeMin
      ? Math.min(Math.max(((targetValue as number) - safeMin) / range, 0), 1) * 100
      : null;
  const resolvedValueLabel =
    typeof valueLabel !== 'undefined'
      ? valueLabel
      : safeMax
        ? `${safeValue}/${safeMax}`
        : safeValue;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-slate-300">{icon}</span>}
          <span className="font-medium text-slate-200 truncate">{label}</span>
        </div>
        {showValue && (
          <span className="font-mono text-slate-100 text-sm">{resolvedValueLabel}</span>
        )}
      </div>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          variant === 'solid' && 'bg-white/10',
          variant === 'outlined' && 'bg-transparent border border-white/10',
          variant === 'minimal' && 'bg-transparent',
          variant === 'candlestick' && 'bg-transparent',
          heightMap[size],
          trackClassName,
        )}
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
      >
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full bg-gradient-to-r transition-all duration-500',
            toneClasses[tone],
            barClassName,
          )}
          style={{ width: `${percentage}%` }}
        />
        {variant === 'candlestick' && percentage < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-px"
            style={{
              left: `${percentage}%`,
              right: 0,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
            }}
          />
        )}
        {targetPercentage !== null && (
          <span
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-slate-900/80 bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
            style={{ left: `${targetPercentage}%` }}
            aria-label={
              targetLabel
                ? typeof targetLabel === 'string'
                  ? targetLabel
                  : undefined
                : 'Target value'
            }
            title={typeof targetLabel === 'string' ? targetLabel : undefined}
          >
            {typeof targetLabel !== 'string' ? targetLabel : null}
          </span>
        )}
      </div>
      {helperText && <div className="text-xs text-slate-400">{helperText}</div>}
    </div>
  );
};

export default MetricBar;
