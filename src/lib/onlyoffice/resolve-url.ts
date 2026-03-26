import { getOnlyofficePublicUrl } from "@/lib/onlyoffice/env";

/** Если ONLYOFFICE вернул относительный url, дополняем базой Document Server. */
export function resolveOnlyofficeDownloadUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = getOnlyofficePublicUrl();
  if (!base) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}
