"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  fileId: string;
  documentServerUrl: string;
  token: string;
  documentType: string;
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: Record<string, unknown>) => void;
    };
  }
}

/** Защита от двойного init (React Strict Mode) на одном placeholder. */
const onlyofficeInitGuard = new Set<string>();

export function OnlyofficeEditor({
  fileId,
  documentServerUrl,
  token,
  documentType,
}: Props) {
  const editorId = useMemo(
    () => `onlyoffice-${fileId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [fileId]
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scriptSrc = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;

    const run = () => {
      if (onlyofficeInitGuard.has(editorId)) return;
      if (!window.DocsAPI) {
        setError("ONLYOFFICE API не загружен");
        return;
      }
      if (!document.getElementById(editorId)) return;
      try {
        onlyofficeInitGuard.add(editorId);
        const formatOoEvent = (data: unknown) =>
          typeof data === "string"
            ? data
            : data != null
              ? JSON.stringify(data)
              : "";

        new window.DocsAPI.DocEditor(editorId, {
          documentType,
          documentServerUrl,
          token,
          width: "100%",
          height: "100%",
          type: "desktop",
          events: {
            onError: (e: { data?: unknown }) => {
              const t = formatOoEvent(e?.data);
              setError(t || "Ошибка ONLYOFFICE (см. консоль iframe)");
            },
            onWarning: (e: { data?: unknown }) => {
              const t = formatOoEvent(e?.data);
              if (t) console.warn("[ONLYOFFICE]", t);
            },
          },
        });
      } catch (e) {
        onlyofficeInitGuard.delete(editorId);
        setError(e instanceof Error ? e.message : "Ошибка редактора");
      }
    };

    const existing = Array.from(document.querySelectorAll("script")).find(
      (s) => s.getAttribute("src") === scriptSrc
    );

    if (window.DocsAPI) {
      run();
      return () => {
        onlyofficeInitGuard.delete(editorId);
      };
    }

    if (existing) {
      const onLoad = () => run();
      existing.addEventListener("load", onLoad);
      return () => {
        existing.removeEventListener("load", onLoad);
        onlyofficeInitGuard.delete(editorId);
      };
    }

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = run;
    script.onerror = () => setError("Не удалось загрузить скрипт ONLYOFFICE");
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
      onlyofficeInitGuard.delete(editorId);
    };
  }, [documentServerUrl, token, documentType, editorId]);

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[480px] w-full flex-col">
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div
        id={editorId}
        className="min-h-[480px] flex-1 w-full overflow-hidden rounded-xl border border-border bg-background"
      />
    </div>
  );
}
