"use client";

import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, footer, className }) => {
  return (
    <div
      className={`group relative overflow-visible rounded-2xl border transition-all duration-150 hover:-translate-y-0.5 ${className ?? ''}`}
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border-subtle)',
        boxShadow: '0 14px 32px -18px rgba(0,0,0,0.7)',
        zIndex: 1,
      }}
    >
      <div
        className="pointer-events-none absolute left-6 right-6 h-8 rounded-xl opacity-0 blur-[8px] transition-opacity duration-200 group-hover:opacity-90"
        style={{
          top: 'calc(100% + 4px)',
          background: 'radial-gradient(ellipse at center top, rgba(46,234,255,0.5) 0%, rgba(46,234,255,0.2) 45%, rgba(46,234,255,0) 100%)',
          zIndex: -1,
        }}
      />
      <div className="absolute inset-0 rounded-2xl border border-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none"
        style={{
          boxShadow: '0 0 0 1px rgba(46, 234, 255, 0.32), 0 0 18px rgba(46, 234, 255, 0.3)',
        }}
      />
      <div className="relative z-10">
        {title ? (
          <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white/80">
            {title}
          </div>
        ) : null}
        <div className="p-4 text-slate-200 text-sm">
          {children}
        </div>
        {footer ? <div className="border-t border-white/5 px-4 py-3 text-xs text-slate-300">{footer}</div> : null}
      </div>
    </div>
  );
};

export default Card;
