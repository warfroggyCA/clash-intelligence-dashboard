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
      "style-src 'self' 'unsafe-inline'", // allow inline styles for Tailwind runtime
      "font-src 'self' data:",
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
  eslint: {
    // Temporarily disable ESLint during builds due to version compatibility issues
    ignoreDuringBuilds: true,
  },
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

// Force deployment refresh - Sat Sep 13 18:58:26 EDT 2025
