"use client";

import React from 'react';

export type ButtonTone = 'primary' | 'accentAlt' | 'success' | 'warning' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
}

const toneStyles: Record<ButtonTone, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#0f172a',
    boxShadow: 'var(--shadow-neon)',
  },
  accentAlt: {
    background: 'var(--accent-alt)',
    color: '#0f172a',
    boxShadow: 'var(--shadow-glass)',
  },
  success: {
    background: '#34d399',
    color: '#0f172a',
  },
  warning: {
    background: '#f59e0b',
    color: '#0f172a',
  },
  danger: {
    background: '#f87171',
    color: '#fff',
  },
  ghost: {
    background: 'var(--panel)',
    color: 'var(--text)',
    border: '1px solid var(--border-subtle)',
  },
};

export const Button: React.FC<ButtonProps> = ({ tone = 'ghost', className = '', style, children, ...rest }) => {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '0.01em',
    transition: 'transform 120ms ease, filter 120ms ease, box-shadow 150ms ease',
    ...toneStyles[tone],
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 ${className}`}
      style={{ ...base, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
