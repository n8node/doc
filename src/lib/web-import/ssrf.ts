/**
 * Базовая защита от SSRF: только http(s), не localhost и не частные/зарезервированные адреса.
 */

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const a = +m[1],
    b = +m[2],
    c = +m[3],
    d = +m[4];
  if ([a, b, c, d].some((x) => x > 255)) return null;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10 (CGN), 192.0.0.0/24, 198.18.0.0/15 benchmark
  if (n < 0x1000000) return true;
  if ((n >>> 24) === 10) return true;
  if ((n >>> 24) === 127) return true;
  if ((n >>> 16) === 0xa9fe) return true;
  if ((n >>> 22) === 0x2b) return true; // 172.16–172.31
  if ((n >>> 16) === 0xc0a8) return true;
  if ((n >>> 22) === 0x19) return true; // 100.64–100.127
  if ((n >>> 24) === 0 && (n >>> 16) !== 0) return true;
  return false;
}

/** Блокируем очевидные локальные hostname */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata",
]);

export class SsrfBlockedError extends Error {
  constructor(message = "URL не разрешён политикой безопасности") {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

export function assertUrlAllowed(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SsrfBlockedError("Некорректный URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError("Разрешены только http и https");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new SsrfBlockedError();
  }

  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (isPrivateOrReservedIpv4(host)) throw new SsrfBlockedError();
  }

  // IPv6 — блокируем всё непубличное грубо: localhost и fc00::/7
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fc") || inner.startsWith("fd")) {
      throw new SsrfBlockedError();
    }
  }

  return url;
}

export function normalizeHttpUrl(raw: string): string {
  const url = assertUrlAllowed(raw);
  url.hash = "";
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
    url.pathname = path;
  }
  return url.href;
}
