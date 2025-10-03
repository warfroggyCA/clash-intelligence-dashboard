/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

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
  // 🚀 VERCEL BUILD OPTIMIZATIONS
  // ============================================
  
  // Compiler optimizations
  compiler: {
    // Remove console logs in production (faster runtime)
    removeConsole: isProd ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
  },

  // Experimental features for faster builds
  experimental: {
    // Optimize package imports - reduces bundle size
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    // Use SWC minifier (faster than Terser)
    swcMinify: true,
  },

  // Output configuration for Vercel
  output: 'standalone', // Creates optimized production bundle

  // ESLint - skip during builds for speed
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript - already type-checked in dev, skip in build
  typescript: {
    ignoreBuildErrors: false, // Set to true only if you're 100% confident
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'], // Modern formats, smaller sizes
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
    // Reduce image optimization timeout
    minimumCacheTTL: 60,
  },

  // Production source maps - disable for faster builds
  productionBrowserSourceMaps: false,

  // Compress output
  compress: true,

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

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Only apply optimizations in production
    if (isProd && !isServer) {
      // Enable tree shaking (client-side only)
      config.optimization.usedExports = true;
      
      // Split chunks for better caching (client-side only)
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for node_modules
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;

// Build timestamp: 2025-01-25 - Vercel optimization update