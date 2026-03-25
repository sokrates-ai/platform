/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/umami/script.js',
        destination: `https://eu.umami.is/script.js`,
      },
      {
        source: '/umami/api/send',
        destination: `https://eu.umami.is/api/send`,
      },
    ]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.c1.mik-mueller.de',
      },
      {
        protocol: 'https',
        hostname: 'nachrichten.idw-online.de',
      },
    ],
  },
  productionBrowserSourceMaps: true,
  reactStrictMode: false,
  output: 'standalone',
}

module.exports = nextConfig
