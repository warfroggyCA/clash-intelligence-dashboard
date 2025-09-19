/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
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
