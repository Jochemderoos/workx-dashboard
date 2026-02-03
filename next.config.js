/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
}

module.exports = nextConfig
