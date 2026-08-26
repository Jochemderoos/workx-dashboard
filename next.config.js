/** @type {import('next').NextConfig} */
const BUILD_ID = Date.now().toString()

const nextConfig = {
  poweredByHeader: false,
  // Skip ESLint + TS-check tijdens Vercel build — beide draaien lokaal via
  // pre-commit hook (scripts/git-hooks/pre-commit). Bespaart ~30-90s deploy.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Expose build ID to client-side code for stale-version detection
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', 'pdfjs-dist', '@vercel/blob'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.workxadvocaten.nl',
      },
      {
        protocol: 'https',
        hostname: 'workxadvocaten.nl',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Expose build ID to client for stale-version detection
  generateBuildId: async () => {
    return Date.now().toString()
  },
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Browser onthoudt een jaar lang dat dit domein alleen via https mag —
          // voorkomt dat een eerste request over http onderschept wordt.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Niets op het dashboard gebruikt camera/microfoon/locatie.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src 'self' data: blob: https:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              // Formulieren (o.a. het inlogformulier) mogen alleen naar het
              // eigen domein posten, en de site mag niet in een iframe elders.
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // Dashboard pages: no-cache ensures browser revalidates with server after deploy
        source: '/dashboard/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
