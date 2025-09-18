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
      className={`glass-card relative flex flex-col overflow-hidden rounded-4xl border border-white/15 bg-transparent px-7 py-6 backdrop-blur-xl shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-glow ${className ?? ''}`.trim()}
      {...rest}
    >
      {(title || subtitle || actions || icon) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {icon && (
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-secondary/25 via-brand-primary/20 to-brand-primary/10 text-brand-primary shadow-[0_8px_18px_-10px_rgba(255,107,10,0.6)]">
                <div className="absolute inset-0 rounded-2xl border border-white/20" />
                <div className="relative">
                  {icon}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {title && (
                <h3 className="text-lg font-semibold leading-tight text-slate-50">{title}</h3>
              )}
              {subtitle && (
                <p className="text-[13px] font-medium text-slate-300/90">{subtitle}</p>
              )}
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
