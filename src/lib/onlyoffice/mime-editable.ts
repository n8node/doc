import { normalizeMimeType } from "@/lib/docling/mime-processable";

const OO_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const OO_EXT = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "csv",
]);

export function isOnlyOfficeEditable(mimeType: string, fileName?: string): boolean {
  const m = normalizeMimeType(mimeType);
  if (OO_MIMES.has(m)) return true;
  const ext = fileName?.trim().toLowerCase().split(".").pop() ?? "";
  if (ext && OO_EXT.has(ext)) {
    return m === "application/octet-stream" || m === "binary/octet-stream" || m === "";
  }
  return false;
}

export type OnlyOfficeDocumentKind = "word" | "cell" | "slide";

export function getOnlyOfficeFileTypeAndKind(
  mimeType: string,
  fileName: string
): { fileType: string; documentType: OnlyOfficeDocumentKind } | null {
  const lower = fileName.trim().toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() ?? "" : "";

  const byExt = (): { fileType: string; documentType: OnlyOfficeDocumentKind } | null => {
    if (["doc", "docx", "odt", "rtf"].includes(ext))
      return { fileType: ext === "doc" ? "doc" : ext === "odt" ? "odt" : ext === "rtf" ? "rtf" : "docx", documentType: "word" };
    if (["xls", "xlsx", "ods", "csv"].includes(ext))
      return {
        fileType: ext === "xls" ? "xls" : ext === "ods" ? "ods" : ext === "csv" ? "csv" : "xlsx",
        documentType: "cell",
      };
    if (["ppt", "pptx", "odp"].includes(ext))
      return { fileType: ext === "ppt" ? "ppt" : ext === "odp" ? "odp" : "pptx", documentType: "slide" };
    return null;
  };

  const m = normalizeMimeType(mimeType);
  if (m.includes("wordprocessingml") || m === "application/msword")
    return { fileType: ext === "doc" ? "doc" : "docx", documentType: "word" };
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel" || m === "text/csv")
    return { fileType: m === "text/csv" || ext === "csv" ? "csv" : ext === "xls" ? "xls" : "xlsx", documentType: "cell" };
  if (m.includes("presentationml") || m === "application/vnd.ms-powerpoint")
    return { fileType: ext === "ppt" ? "ppt" : "pptx", documentType: "slide" };

  return byExt();
}

/**
 * Ключ сессии ONLYOFFICE: уникален на версию (меняется при сохранении → новый updatedAt).
 * Допустимые символы: 0-9 a-z A-Z - . _
 */
export function buildOnlyOfficeDocumentKey(fileId: string, updatedAt: Date): string {
  return `${fileId}.${updatedAt.getTime()}`;
}

export function parseOnlyofficeDocumentKey(key: string): { fileId: string } | null {
  const i = key.indexOf(".");
  if (i <= 0) return null;
  const fileId = key.slice(0, i);
  const rest = key.slice(i + 1);
  if (!fileId || !/^\d+$/.test(rest)) return null;
  return { fileId };
}
