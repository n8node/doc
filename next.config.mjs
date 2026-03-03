/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.yandex*.ru", pathname: "/**" },
      { protocol: "https", hostname: "qoqon.ru", pathname: "/**" },
    ],
  },
  // i18n: locales через next-intl или middleware для App Router
};

export default nextConfig;
