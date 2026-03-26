import { SignJWT } from "jose";
import type { OnlyOfficeDocumentKind } from "@/lib/onlyoffice/mime-editable";
import {
  getAppInternalUrlForOnlyoffice,
  getOnlyofficeJwtSecret,
  getOnlyofficePublicUrl,
} from "@/lib/onlyoffice/env";
import { signDocumentDownloadJwt } from "@/lib/onlyoffice/download-jwt";

export interface OnlyofficeEditorConfigInput {
  fileId: string;
  fileName: string;
  fileType: string;
  documentType: OnlyOfficeDocumentKind;
  documentKey: string;
  userId: string;
  userName: string;
}

export interface OnlyofficeClientBootstrap {
  documentServerUrl: string;
  token: string;
  documentType: OnlyOfficeDocumentKind;
}

/**
 * Собирает конфиг ONLYOFFICE и подписывает тем же секретом, что включён JWT на Document Server.
 */
export async function buildSignedOnlyofficeEditorBootstrap(
  input: OnlyofficeEditorConfigInput
): Promise<OnlyofficeClientBootstrap | { error: string }> {
  const secret = getOnlyofficeJwtSecret();
  const publicUrl = getOnlyofficePublicUrl();
  if (!secret || !publicUrl) {
    return {
      error:
        "ONLYOFFICE не настроен (задайте ONLYOFFICE_JWT_SECRET и ONLYOFFICE_DOCUMENT_SERVER_URL в .env)",
    };
  }

  const internal = getAppInternalUrlForOnlyoffice();
  const downloadToken = await signDocumentDownloadJwt({
    fileId: input.fileId,
    userId: input.userId,
  });

  const documentUrl = `${internal}/api/onlyoffice/document/${encodeURIComponent(input.fileId)}?token=${encodeURIComponent(downloadToken)}`;
  const callbackUrl = `${internal}/api/onlyoffice/callback`;

  const config: Record<string, unknown> = {
    document: {
      fileType: input.fileType,
      key: input.documentKey,
      title: input.fileName,
      url: documentUrl,
    },
    documentType: input.documentType,
    editorConfig: {
      mode: "edit",
      callbackUrl,
      /** fast — при рабочем /coauthoring (nginx → onlyoffice). Если скелет без WS — верните strict. */
      coEditing: { mode: "fast", change: false },
      user: {
        id: input.userId,
        name: input.userName.slice(0, 200) || "User",
      },
      lang: "ru",
      permissions: {
        comment: true,
        download: true,
        edit: true,
        print: true,
        review: true,
      },
      customization: {
        forcesave: true,
        compactToolbar: false,
      },
    },
  };

  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT(config as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(key);

  return {
    documentServerUrl: publicUrl,
    token,
    documentType: input.documentType,
  };
}
