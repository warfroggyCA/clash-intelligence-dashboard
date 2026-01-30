"use client";

import React from 'react';

export type ButtonTone = 'primary' | 'accentAlt' | 'success' | 'warning' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
  /** When true, renders in a busy/disabled state (caller controls label/spinner if desired). */
  loading?: boolean;
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

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '8px 12px', fontSize: '13px' },
  md: { padding: '10px 14px', fontSize: '14px' },
  lg: { padding: '14px 18px', fontSize: '16px' },
};

export const Button: React.FC<ButtonProps> = ({
  tone = 'ghost',
  size = 'md',
  loading = false,
  className = '',
  style,
  children,
  disabled,
  ...rest
}) => {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    letterSpacing: '0.01em',
    transition: 'transform 120ms ease, filter 120ms ease, box-shadow 150ms ease',
    ...sizeStyles[size],
    ...toneStyles[tone],
  };

  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 ${className}`}
      style={{
        ...base,
        ...(isDisabled ? { opacity: 0.8, cursor: 'not-allowed', filter: 'grayscale(0.1)' } : null),
        ...style,
      }}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
