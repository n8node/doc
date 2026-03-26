import { SignJWT, jwtVerify } from "jose";
import { getOnlyofficeJwtSecret } from "@/lib/onlyoffice/env";

const CLAIM = "oo_dl";

export async function signDocumentDownloadJwt(input: {
  fileId: string;
  userId: string;
}): Promise<string> {
  const secret = getOnlyofficeJwtSecret();
  if (!secret) throw new Error("ONLYOFFICE_JWT_SECRET is not set");
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    [CLAIM]: true,
    fileId: input.fileId,
    userId: input.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(key);
}

export async function verifyDocumentDownloadJwt(token: string): Promise<{
  fileId: string;
  userId: string;
} | null> {
  const secret = getOnlyofficeJwtSecret();
  if (!secret) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload[CLAIM] !== true) return null;
    const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!fileId || !userId) return null;
    return { fileId, userId };
  } catch {
    return null;
  }
}
