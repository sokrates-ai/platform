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
  async headers() {
    return [
      {
        /*
         * Course map sprites. Next serves public/ with `max-age=0`, so a
         * browser revalidates all ~45 sprites on every navigation - roughly 49
         * conditional requests per page view, which at 120 concurrent users is
         * several hundred requests a second against a single Next process.
         *
         * These are static art shipped with the build. A day of freshness plus
         * a week of stale-while-revalidate removes the revalidation entirely
         * within a session while bounding how long a replaced sprite can
         * linger. They are not content-hashed, so this deliberately stops short
         * of `immutable`.
         */
        source: '/contentMap/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
  productionBrowserSourceMaps: false,
  reactStrictMode: false,
  output: 'standalone',
}

module.exports = nextConfig
