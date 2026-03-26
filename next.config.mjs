/** @type {import('next').NextConfig} */
const onlyofficeInternal =
  process.env.ONLYOFFICE_INTERNAL_ORIGIN?.replace(/\/+$/, "") || "http://onlyoffice";

const nextConfig = {
  output: "standalone",
  experimental: {
    /** Playwright — нативный модуль; не бандлить в server chunks */
    serverComponentsExternalPackages: ["playwright"],
  },
  async rewrites() {
    const list = [
      {
        source: "/favicon.ico",
        destination: "/api/public/favicon-redirect",
      },
    ];
    /**
     * Когда HTTPS отдаёт системный nginx сразу в Next (без location /onlyoffice/),
     * статика ONLYOFFICE должна проксироваться приложением на контейнер onlyoffice.
     * В Docker: http://onlyoffice. Локально в .env: ONLYOFFICE_INTERNAL_ORIGIN=http://127.0.0.1:8088
     */
    if (process.env.ONLYOFFICE_REWRITE !== "false") {
      list.push({
        source: "/onlyoffice/:path*",
        destination: `${onlyofficeInternal}/:path*`,
      });
    }
    return list;
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
