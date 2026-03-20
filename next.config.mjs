/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    /** Playwright — нативный модуль; не бандлить в server chunks */
    serverComponentsExternalPackages: ["playwright"],
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/api/public/favicon-redirect",
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
