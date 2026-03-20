/**
 * VK ID может отдавать результат авторизации в query-параметре `payload` (JSON или base64url JSON).
 */

function tryParseJsonObject(s: string): { code?: string; state?: string; device_id?: string } | null {
  try {
    const p = JSON.parse(s) as { code?: string; state?: string; device_id?: string };
    if (p.code && p.state) return p;
  } catch {
    /* ignore */
  }
  return null;
}

function base64UrlToBinaryString(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

export function tryParseVkIdPayloadParam(raw: string): { code?: string; state?: string; device_id?: string } | null {
  const decoded = decodeURIComponent(raw.replace(/\+/g, " "));
  let parsed = tryParseJsonObject(decoded);
  if (parsed) return parsed;

  try {
    parsed = tryParseJsonObject(base64UrlToBinaryString(raw));
    if (parsed) return parsed;
  } catch {
    /* ignore */
  }

  return null;
}
