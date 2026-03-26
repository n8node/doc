import { SignJWT } from "jose";
import type { OnlyOfficeDocumentKind } from "@/lib/onlyoffice/mime-editable";
import {
  getOnlyofficeDocumentAndCallbackBaseUrl,
  getOnlyofficeJwtSecret,
  getOnlyofficePublicUrl,
} from "@/lib/onlyoffice/env";

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
  /** Откуда DS качает файл (для диагностики скелета без onDocumentReady) */
  documentFetchBase: string;
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

  const base = getOnlyofficeDocumentAndCallbackBaseUrl();
  /**
   * Без ?token= в query: при JWT_ENABLED DS обычно качает файл с Authorization: Bearer
   * (тот же JWT, что передаётся в DocEditor). Длинный query режут прокси; Bearer уже есть в verify.
   * Скачивание по ?token= в route оставлено для ручных проверок и совместимости.
   */
  const documentUrl = `${base}/api/onlyoffice/document/${encodeURIComponent(input.fileId)}`;
  const callbackUrl = `${base}/api/onlyoffice/callback`;
  try {
    const u = new URL(documentUrl);
    console.log(
      `[onlyoffice build] documentUrl origin=${u.origin} path=${u.pathname} bearerOnly=1 callbackOrigin=${new URL(callbackUrl).origin}`
    );
  } catch (e) {
    console.log("[onlyoffice build] documentUrl parse error", String(e));
  }

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
      /** strict — меньше зависимость от WebSocket; при рабочем /coauthoring можно попробовать fast */
      coEditing: { mode: "strict", change: false },
      user: {
        id: input.userId,
        name: input.userName.slice(0, 200) || "User",
      },
      lang: "ru",
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
    documentFetchBase: base,
  };
}
