/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
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
