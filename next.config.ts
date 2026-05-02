import type { NextConfig } from "next";

const SUPABASE_URL = 'https://zoknsjiaizwxehznpgnk.supabase.co'
const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
          // Solo en producción: HSTS y CSP estricto
          ...(!isDev ? [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                `img-src 'self' data: blob: ${SUPABASE_URL}`,
                "font-src 'self'",
                `connect-src 'self' ${SUPABASE_URL}`,
                "frame-ancestors 'none'",
              ].join('; '),
            },
          ] : []),
        ],
      },
    ]
  },
};

export default nextConfig;
