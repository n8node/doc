import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { buildOnlyofficeUpstreamUrl } from "@/lib/onlyoffice/middleware-proxy";
import { tryParseVkIdPayloadParam } from "@/lib/vk-id-payload";

/** openid-client выкидывает device_id из query (pickCb); пробрасываем в token.request через заголовок. */
const VK_DEVICE_ID_HEADER = "x-vk-device-id";

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    if (token?.isBlocked) {
      const url = new URL("/login", req.url);
      url.searchParams.set("error", "blocked");
      const res = NextResponse.redirect(url);
      res.cookies.delete("next-auth.session-token");
      res.cookies.delete("__Secure-next-auth.session-token");
      return res;
    }

    if (token && req.nextUrl.pathname.startsWith("/admin")) {
      if (token.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  }
);

/**
 * VK ID редиректит на redirect_uri с JSON в query-параметре `payload`, а NextAuth ждёт `code`/`state`/`device_id`.
 */
function normalizeVkIdCallbackPayload(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== "/api/auth/callback/vk") return null;
  const payload = req.nextUrl.searchParams.get("payload");
  if (!payload) return null;
  const parsed = tryParseVkIdPayloadParam(payload);
  if (!parsed?.code || !parsed.state) return null;
  const url = req.nextUrl.clone();
  url.searchParams.delete("payload");
  url.searchParams.set("code", parsed.code);
  url.searchParams.set("state", parsed.state);
  if (parsed.device_id) url.searchParams.set("device_id", parsed.device_id);
  return NextResponse.redirect(url);
}

function forwardVkDeviceIdHeader(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== "/api/auth/callback/vk") return null;
  const deviceId = req.nextUrl.searchParams.get("device_id");
  if (!deviceId) return null;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(VK_DEVICE_ID_HEADER, deviceId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Прокси на Document Server до маршрутизации Next — надёжнее, чем rewrites на внешний origin в standalone.
 */
function tryOnlyofficeRewrite(req: NextRequest): NextResponse | null {
  const upstream = buildOnlyofficeUpstreamUrl(req);
  if (!upstream) return null;
  const requestHeaders = new Headers(req.headers);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) requestHeaders.set("x-forwarded-host", host);
  const proto = req.nextUrl.protocol.replace(":", "") || "https";
  requestHeaders.set("x-forwarded-proto", proto);
  return NextResponse.rewrite(upstream, { request: { headers: requestHeaders } });
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const ooRewrite = tryOnlyofficeRewrite(req);
  if (ooRewrite) return ooRewrite;
  const vkRedirect = normalizeVkIdCallbackPayload(req);
  if (vkRedirect) return vkRedirect;
  const vkForwarded = forwardVkDeviceIdHeader(req);
  if (vkForwarded) return vkForwarded;
  // next-auth типизирует запрос как уже обогащённый nextauth — до вызова это обычный NextRequest
  return authMiddleware(req as Parameters<typeof authMiddleware>[0], event);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/auth/callback/vk",
    "/onlyoffice",
    "/onlyoffice/:path*",
    "/web-apps",
    "/web-apps/:path*",
    "/cache",
    "/cache/:path*",
    "/coauthoring",
    "/coauthoring/:path*",
    "/sdkjs",
    "/sdkjs/:path*",
    "/sdkjs-plugins",
    "/sdkjs-plugins/:path*",
    "/fonts",
    "/fonts/:path*",
    "/dictionaries",
    "/dictionaries/:path*",
    "/meta",
    "/meta/:path*",
    "/document_editor_service_worker.js",
  ],
};
