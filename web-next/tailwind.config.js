/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  safelist: [
    // Dynamic gradient classes used in RosterStatsPanel - use patterns to catch all variations
    { pattern: /^from-(blue|indigo|purple|amber|orange)-400\/40$/ },
    { pattern: /^via-(blue|indigo|purple|amber|orange)-300\/20$/ },
    { pattern: /^to-(blue|indigo|purple|amber|orange)-500\/50$/ },
    { pattern: /^to-orange-400\/50$/ },
    // Glass card classes
    'glass-card', 'backdrop-blur-xl', 'backdrop-blur-sm',
    // Dynamic gradient classes for highlights
    'from-white/20', 'via-white/10', 'to-white/20',
    // Border and shadow classes
    'border-white/40', 'border-white/30', 'border-white/15',
    'shadow-lg', 'shadow-md', 'drop-shadow-sm', 'drop-shadow-md',
    // Text and background classes
    'text-white', 'text-white/80', 'text-white/90', 'text-amber-100',
    'bg-white/95', 'bg-white/15', 'bg-white/20', 'bg-white/10',
    // Layout classes
    'min-h-[8rem]', 'min-h-[18rem]', 'h-10', 'w-10', 'h-9', 'w-9',
    'rounded-2xl', 'rounded-xl', 'rounded-4xl',
    // Spacing classes
    'px-4', 'py-6', 'py-3', 'px-7', 'py-6',
    'space-y-4', 'space-y-6', 'gap-4', 'gap-6',
    // Flexbox classes
    'flex', 'flex-col', 'items-center', 'justify-center', 'justify-between',
    // Grid classes
    'grid', 'grid-cols-2', 'grid-cols-1', 'lg:grid-cols-2',
    // Typography classes
    'text-xs', 'text-sm', 'text-xl', 'font-semibold', 'font-bold',
    'uppercase', 'tracking-[0.2em]', 'truncate', 'pr-3',
    // Position classes
    'relative', 'absolute', 'overflow-hidden',
    // Transition classes
    'transition', 'duration-300', 'hover:-translate-y-0.5', 'hover:shadow-glow',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Clash Display"', '"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        display: ['"Clash Display"', '"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        body: ['"Plus Jakarta Sans"', '"Clash Display"', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          primary: '#FF6B0A',
          secondary: '#5227FF',
          accent: '#FACC15',
          surface: '#0E1421',
          glass: 'rgba(18, 24, 40, 0.72)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        clash: {
          gold: '#FFD700',
          'gold-dark': '#B8860B',
          orange: '#FF6B0A',
          'orange-dark': '#CC5500',
          purple: '#5227FF',
          'purple-dark': '#3D1A78',
          blue: '#4A90E2',
          red: '#E74C3C',
          green: '#27AE60',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#E2E8F0',
          muted: '#94A3B8',
          accent: '#FFD700',
        },
      },
      boxShadow: {
        glow: '0 28px 65px -35px rgba(255, 107, 10, 0.55)',
        card: '0 24px 55px -35px rgba(15, 23, 42, 0.65)',
      },
      backdropBlur: {
        xs: '3px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    }
  },
  plugins: []
};
