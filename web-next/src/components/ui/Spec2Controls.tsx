"use client";

import { useMemo } from 'react';

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accentAlt' | 'accent';

type CommonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  ariaLabel?: string;
};

const surface = {
  card: 'var(--card)',
  border: 'var(--border-subtle)',
};

const text = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
};

export function Spec2Button({
  children,
  tone = 'primary',
  ariaLabel,
  className = '',
  ...buttonProps
}: CommonProps & { tone?: Tone; className?: string }) {
  const style = useMemo(() => {
    if (tone === 'primary' || tone === 'accentAlt') return { bg: 'var(--accent-alt)', fg: '#0b1220', border: 'transparent' };
    if (tone === 'secondary' || tone === 'accent') return { bg: 'var(--accent)', fg: '#0b1220', border: 'transparent' };
    if (tone === 'danger') return { bg: 'rgba(248,113,113,0.18)', fg: text.primary, border: 'rgba(248,113,113,0.30)' };
    return { bg: 'transparent', fg: text.primary, border: surface.border };
  }, [tone]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`h-11 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function Spec2IconButton({
  children,
  ariaLabel,
  active,
  className = '',
  ...buttonProps
}: CommonProps & { active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`h-11 w-11 inline-flex items-center justify-center rounded-xl border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      style={{
        background: active ? 'rgba(34,211,238,0.14)' : surface.card,
        borderColor: surface.border,
        color: text.secondary,
        boxShadow: active ? '0 0 0 2px rgba(14,116,144,0.15)' : undefined,
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function Spec2Input({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`h-11 w-full rounded-xl border px-4 text-sm font-semibold outline-none transition-colors ${className}`}
      style={{
        background: 'var(--input)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    />
  );
}
