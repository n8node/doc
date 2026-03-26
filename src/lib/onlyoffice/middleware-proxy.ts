import type { NextRequest } from "next/server";

function internalOrigin(): string {
  return (
    process.env.ONLYOFFICE_INTERNAL_ORIGIN?.replace(/\/+$/, "") || "http://onlyoffice"
  );
}

/**
 * Публичные пути, которые Document Server отдаёт с корня домена (не под /onlyoffice/).
 * Порядок: /sdkjs-plugins раньше /sdkjs.
 */
export function buildOnlyofficeUpstreamUrl(req: NextRequest): URL | null {
  if (process.env.ONLYOFFICE_REWRITE === "false") return null;

  const oo = internalOrigin();
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  if (pathname === "/document_editor_service_worker.js") {
    return new URL(`${oo}/document_editor_service_worker.js${search}`);
  }

  if (pathname === "/onlyoffice" || pathname.startsWith("/onlyoffice/")) {
    const rest =
      pathname === "/onlyoffice" || pathname === "/onlyoffice/"
        ? "/"
        : pathname.slice("/onlyoffice".length);
    const normalized = rest.startsWith("/") ? rest : `/${rest}`;
    return new URL(`${oo}${normalized}${search}`);
  }

  if (pathname.startsWith("/sdkjs-plugins")) {
    return new URL(`${oo}${pathname}${search}`);
  }
  if (pathname.startsWith("/sdkjs")) {
    return new URL(`${oo}${pathname}${search}`);
  }

  if (
    pathname.startsWith("/web-apps") ||
    pathname.startsWith("/cache") ||
    pathname.startsWith("/coauthoring") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/dictionaries") ||
    pathname.startsWith("/meta")
  ) {
    return new URL(`${oo}${pathname}${search}`);
  }

  return null;
}
