// Design tokens (scaffold) for the rebuilt experience
export const tokens = {
  colors: {
    bg: '#070b17',        // page background (deep)
    panel: '#0f1629',     // sidebar/header
    surface: '#141f36',   // sections
    card: '#1e2945',      // cards (lighter for depth)
    input: '#0f1629',     // input wells
    border: 'rgba(255,255,255,0.08)',
    borderSubtle: 'rgba(148,163,184,0.10)',
    text: '#e5e7eb',
    muted: '#9ca3af',
    accent: '#fbbf24',
    accentAlt: '#00eaff',  // brighter cyan for progress/pulse (high contrast)
    success: '#34d399',
    warning: '#f59e0b',
    danger: '#f87171',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
  },
  shadows: {
    sm: '0 6px 20px -12px rgba(0,0,0,0.4)',
    md: '0 12px 32px -16px rgba(0,0,0,0.55)',
    lg: '0 22px 48px -18px rgba(0,0,0,0.6)',
    neon: '0 0 15px -3px rgba(249, 191, 36, 0.3)',
    glass: '0 4px 30px rgba(0,0,0,0.1)',
  },
  font: {
    body: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    display: '"Clash Display", "Plus Jakarta Sans", system-ui, sans-serif',
    sizes: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
    },
  },
};
