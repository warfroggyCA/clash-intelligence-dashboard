import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  className,
  title,
  subtitle,
  actions,
  icon,
  children,
  ...rest
}) => {
  return (
    <div
      className={`glass-card relative flex flex-col overflow-hidden rounded-3xl px-6 py-6 backdrop-blur-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-glow ${className ?? ''}`.trim()}
      {...rest}
    >
      {(title || subtitle || actions || icon) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-surfaceRaised/80 text-brand-primary shadow-[0_12px_22px_-18px_rgba(91,127,255,0.55)]">
                <div className="absolute inset-0 rounded-2xl border border-brand-border/80" />
                <div className="relative text-lg">
                  {icon}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {title && <h3 className="text-base font-semibold leading-tight text-slate-100">{title}</h3>}
              {subtitle && <p className="text-[13px] font-medium text-slate-300/90">{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 text-slate-200">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default GlassCard;
