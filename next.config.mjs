/** @type {import('next').NextConfig} */
const onlyofficeInternal =
  process.env.ONLYOFFICE_INTERNAL_ORIGIN?.replace(/\/+$/, "") || "http://onlyoffice";

function onlyofficeRewrites(oo) {
  return [
    /** Явно без подпути — иначе /onlyoffice не матчится на :path* и даёт 404 */
    { source: "/onlyoffice", destination: `${oo}/` },
    { source: "/onlyoffice/", destination: `${oo}/` },
    { source: "/onlyoffice/:path*", destination: `${oo}/:path*` },
    { source: "/web-apps/:path*", destination: `${oo}/web-apps/:path*` },
    { source: "/cache/:path*", destination: `${oo}/cache/:path*` },
    { source: "/coauthoring/:path*", destination: `${oo}/coauthoring/:path*` },
    /** Редактор тянет с корня домена (не только /onlyoffice/...) */
    { source: "/sdkjs/:path*", destination: `${oo}/sdkjs/:path*` },
    { source: "/sdkjs-plugins/:path*", destination: `${oo}/sdkjs-plugins/:path*` },
    { source: "/fonts/:path*", destination: `${oo}/fonts/:path*` },
    { source: "/dictionaries/:path*", destination: `${oo}/dictionaries/:path*` },
    { source: "/meta/:path*", destination: `${oo}/meta/:path*` },
    { source: "/document_editor_service_worker.js", destination: `${oo}/document_editor_service_worker.js` },
  ];
}

const nextConfig = {
  output: "standalone",
  experimental: {
    /** Playwright — нативный модуль; не бандлить в server chunks */
    serverComponentsExternalPackages: ["playwright"],
  },
  async rewrites() {
    const favicon = {
      source: "/favicon.ico",
      destination: "/api/public/favicon-redirect",
    };

    if (process.env.ONLYOFFICE_REWRITE === "false") {
      return [favicon];
    }

    const oo = onlyofficeInternal;
    /**
     * beforeFiles — до проверки файлов/страниц, чтобы /onlyoffice и корневые пути DS не ловились приложением.
     * Редирект на /welcome в коде проекта нет — если он есть, ищите nginx/панель хостинга.
     */
    return {
      beforeFiles: [favicon, ...onlyofficeRewrites(oo)],
    };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.yandex*.ru", pathname: "/**" },
      { protocol: "https", hostname: "qoqon.ru", pathname: "/**" },
    ],
  },
};

export default nextConfig;
