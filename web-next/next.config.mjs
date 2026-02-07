/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const disableMinify = process.env.NEXT_DISABLE_MINIFY === '1' || process.env.NEXT_DISABLE_MINIFY === 'true';

const securityHeaders = [
  // Prevent MIME type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking protection
  { key: 'X-Frame-Options', value: 'DENY' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'same-origin' },
  // Basic permissions policy (lock down sensitive APIs)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy (baseline; adjust if needed)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // allow inline styles for Tailwind runtime and Google Fonts
      "font-src 'self' data: https://fonts.gstatic.com", // allow Google Fonts
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next dev/webpack needs eval; fine in prod for Next runtime
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  // HSTS (only in production; set via headers() below)
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  
  // ============================================
  // 🚀 SIMPLIFIED VERCEL BUILD OPTIMIZATIONS
  // ============================================
  
  // Remove console logs in production
  compiler: {
    removeConsole: isProd ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Skip ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api-assets.clashofclans.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn-assets-eu.frontify.com',
      },
    ],
  },

  // Disable production source maps for faster builds
  productionBrowserSourceMaps: false,

  // Optional override for production minification.
  // Default is minified builds; set NEXT_DISABLE_MINIFY=1 only for temporary debugging.
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev && disableMinify) {
      config.optimization.minimize = false;
    }
    return config;
  },

  // Security headers
  async headers() {
    if (!isProd) return [];
    return [
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;

// Build timestamp: 2025-01-25 - Simplified config
