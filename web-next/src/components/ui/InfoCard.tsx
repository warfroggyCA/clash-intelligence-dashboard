"use client";

import Link from 'next/link';
import React, { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type InfoCardBadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent';

export interface InfoCardBadge {
  label: ReactNode;
  tone?: InfoCardBadgeTone;
  icon?: ReactNode;
  subtle?: boolean;
}

export interface InfoCardStat {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export interface InfoCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  kicker?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  badges?: InfoCardBadge[];
  stats?: InfoCardStat[];
  metadata?: { label: ReactNode; value: ReactNode }[];
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
  interactive?: boolean;
  disabled?: boolean;
  density?: 'comfortable' | 'compact';
}

// =============================================================================
// HELPERS
// =============================================================================

const badgeToneClasses: Record<InfoCardBadgeTone, string> = {
  neutral: 'bg-white/5 text-slate-200 border-white/10',
  info: 'bg-blue-500/10 text-blue-200 border-blue-500/30',
  success: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-100 border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-100 border-rose-500/30',
  accent: 'bg-clash-gold/15 text-clash-gold border-clash-gold/30',
};

const statToneClasses = 'text-xs uppercase tracking-wide text-slate-400';

// =============================================================================
// COMPONENT
// =============================================================================

export const InfoCard = forwardRef<HTMLDivElement, InfoCardProps>(function InfoCard(
  {
    title,
    subtitle,
    kicker,
    leading,
    trailing,
    badges = [],
    stats,
    metadata,
    actions,
    footer,
    children,
    className = '',
    href,
    onClick,
    interactive,
    disabled = false,
    density = 'comfortable',
  },
  ref,
) {
  const isInteractive = !disabled && (interactive || !!href || !!onClick);

  const baseCard = (
    <div
      ref={ref}
      className={cn(
        'info-card group relative w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-[0_12px_35px_-28px_rgba(8,15,31,0.65)] backdrop-blur',
        density === 'compact' && 'p-3',
        isInteractive &&
          'transition-transform duration-200 hover:-translate-y-0.5 hover:border-clash-gold/60 hover:bg-white/8 focus-within:-translate-y-0.5 focus-within:border-clash-gold/60 focus-within:bg-white/8',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading && <div className="flex-shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1">
            {kicker && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                {kicker}
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-lg font-semibold text-white leading-tight truncate"
                    style={{ fontFamily: '"Clash Display", "Plus Jakarta Sans", system-ui, sans-serif' }}
                  >
                    {title}
                  </h3>
                </div>
                {subtitle && <p className="text-sm text-slate-400 line-clamp-2">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2 text-xs text-slate-400">{actions}</div>}
            </div>
          </div>

          {badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {badges.map((badge, index) => (
                <span
                  key={`${badge.label}-${index}`}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    badgeToneClasses[badge.tone ?? 'neutral'],
                    badge.subtle && 'border-transparent bg-white/5 text-slate-300',
                  )}
                >
                  {badge.icon && <span className="text-current">{badge.icon}</span>}
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          {stats && stats.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((stat, index) => (
                <div key={`${index}-${stat.label}`} className="space-y-0.5">
                  <dt className={statToneClasses}>{stat.label}</dt>
                  <dd className="text-base font-semibold text-slate-100">{stat.value}</dd>
                  {stat.hint && <p className="text-xs text-slate-500">{stat.hint}</p>}
                </div>
              ))}
            </dl>
          )}

          {children && <div className="space-y-3">{children}</div>}

          {metadata && metadata.length > 0 && (
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 sm:grid-cols-3">
              {metadata.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  <p className="font-semibold tracking-wide text-slate-500 uppercase text-[10px]">
                    {item.label}
                  </p>
                  <p className="text-white text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {footer && <div className="pt-2 border-t border-white/5 text-sm text-slate-300">{footer}</div>}
        </div>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>
    </div>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clash-gold focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl"
      >
        {baseCard}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clash-gold focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl"
        disabled={disabled}
      >
        {baseCard}
      </button>
    );
  }

  return baseCard;
});

export default InfoCard;
