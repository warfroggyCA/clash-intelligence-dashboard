/**
 * MetricCard Component
 * 
 * Standardized metric display component with consistent styling,
 * optional tooltip support, and consistent spacing.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { TOOLTIP_CONTENT } from '@/lib/tooltips/tooltip-content';

// =============================================================================
// TYPES
// =============================================================================

export interface MetricCardProps {
  label: string;
  value: string | number | React.ReactNode;
  description?: string;
  tooltip?: string | React.ReactNode;
  tooltipKey?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  className?: string;
  valueClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'highlight' | 'muted';
}

// =============================================================================
// COMPONENT
// =============================================================================

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  description,
  tooltip,
  tooltipKey,
  icon,
  trend,
  className = '',
  valueClassName = '',
  size = 'md',
  variant = 'default',
}) => {
  const sizeClasses = {
    sm: {
      card: 'p-3',
      label: 'text-xs',
      value: 'text-lg',
      icon: 'text-base',
    },
    md: {
      card: 'p-4',
      label: 'text-sm',
      value: 'text-2xl',
      icon: 'text-lg',
    },
    lg: {
      card: 'p-6',
      label: 'text-base',
      value: 'text-3xl',
      icon: 'text-xl',
    },
  };

  const variantClasses = {
    default: 'bg-brand-surface/60 border-brand-border/60',
    highlight: 'bg-brand-primary/10 border-brand-primary/30',
    muted: 'bg-brand-surfaceSubtle/40 border-brand-border/40',
  };

  const sizeConfig = sizeClasses[size];

  const content = (
    <div
      className={cn(
        'rounded-xl border backdrop-blur-sm',
        sizeConfig.card,
        variantClasses[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {icon && (
              <span className={cn('flex-shrink-0 text-slate-400', sizeConfig.icon)}>
                {icon}
              </span>
            )}
            <span
              className={cn(
                'font-medium text-slate-400 uppercase tracking-wide',
                sizeConfig.label,
              )}
            >
              {label}
            </span>
          </div>
          <div
            className={cn(
              'font-bold text-slate-100 leading-tight',
              sizeConfig.value,
              valueClassName,
            )}
          >
            {value}
          </div>
          {description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{description}</p>
          )}
          {trend && (
            <div
              className={cn(
                'mt-2 text-xs font-medium',
                trend.positive !== false ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {trend.positive !== false ? '↑' : '↓'} {Math.abs(trend.value)}
              {trend.label && ` ${trend.label}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const resolvedTooltip = tooltipKey && TOOLTIP_CONTENT[tooltipKey]
    ? TOOLTIP_CONTENT[tooltipKey].content
    : tooltip;

  if (resolvedTooltip) {
    return (
      <Tooltip content={resolvedTooltip} position="top" maxWidth="max-w-sm">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default MetricCard;
