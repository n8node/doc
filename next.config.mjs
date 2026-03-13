/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const buildId = process.env.VERCEL_BUILD_ID || process.env.BUILD_ID || "0";
    return [
      {
        source: "/favicon.ico",
        destination: `/api/public/branding/favicon?bust=${buildId}`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.yandex*.ru", pathname: "/**" },
      { protocol: "https", hostname: "qoqon.ru", pathname: "/**" },
    ],
  },
  // i18n: locales через next-intl или middleware для App Router
};

export default nextConfig;
