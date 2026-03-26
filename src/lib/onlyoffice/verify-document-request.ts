import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getOnlyofficeJwtSecret } from "@/lib/onlyoffice/env";

function readUserIdFromPayload(p: Record<string, unknown>): string | null {
  const ec = p.editorConfig as { user?: { id?: string } } | undefined;
  const uid = ec?.user?.id;
  return typeof uid === "string" ? uid : null;
}

function findDocumentAccess(
  p: Record<string, unknown>,
  fileId: string
): { userId: string } | null {
  const doc = p.document as { url?: string } | undefined;
  const url = doc?.url;
  if (typeof url === "string" && url.includes(fileId)) {
    const uid = readUserIdFromPayload(p);
    if (uid) return { userId: uid };
  }
  const nested = p.payload;
  if (nested && typeof nested === "object") {
    return findDocumentAccess(nested as Record<string, unknown>, fileId);
  }
  return null;
}

/**
 * При JWT_ENABLED Document Server может запрашивать файл с Authorization: Bearer
 * (без ?token= в URL). Тогда нужно принять тот же секрет, что и для конфига редактора.
 */
export async function tryVerifyOnlyofficeBearerDocument(
  req: NextRequest,
  fileId: string
): Promise<{ fileId: string; userId: string } | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const bearer = auth.slice(7).trim();
  const secret = getOnlyofficeJwtSecret();
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);
  try {
    const { payload: raw } = await jwtVerify(bearer, key, { algorithms: ["HS256"] });
    const p = raw as Record<string, unknown>;
    const found = findDocumentAccess(p, fileId);
    if (!found) return null;
    return { fileId, userId: found.userId };
  } catch {
    return null;
  }
}
