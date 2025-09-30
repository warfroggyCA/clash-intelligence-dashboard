import React from 'react';
import { GlassCard } from '@/components/ui';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  actions,
  className = '',
  children,
}) => {
  return (
    <GlassCard className={`section-card space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-contrast">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-medium-contrast">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2 text-xs text-muted-contrast">{actions}</div> : null}
      </div>
      <div>{children}</div>
    </GlassCard>
  );
};

export default SectionCard;
