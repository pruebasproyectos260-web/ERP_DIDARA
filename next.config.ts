import type { NextConfig } from "next";

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
          // CSP mínima que no afecta scripts/estilos/imágenes: bloquea plugins (<object>),
          // que inyecten <base> y que el ERP se embeba en otros sitios.
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
          ...(!isDev ? [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          ] : []),
        ],
      },
    ]
  },
};

export default nextConfig;
