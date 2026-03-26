"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clearStuckTimer = () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
    };

    const scriptSrc = `${documentServerUrl.replace(/\/+$/, "")}/web-apps/apps/api/documents/api.js`;

    const formatOoEvent = (data: unknown) =>
      typeof data === "string"
        ? data
        : data != null
          ? JSON.stringify(data)
          : "";

    const run = () => {
      if (!window.DocsAPI) {
        setError("ONLYOFFICE API не загружен");
        return;
      }
      const placeholder = document.getElementById(editorId);
      if (!placeholder) return;
      try {
        clearStuckTimer();
        stuckTimerRef.current = setTimeout(() => {
          setError(
            "Документ не открылся за 90 с. Частая причина: контейнер onlyoffice без ALLOW_PRIVATE_IP_ADDRESS=true — DS не может скачать файл по http://app:3000. Сделайте docker compose up -d onlyoffice после обновления compose. Также проверьте nginx: WebSocket /coauthoring → onlyoffice."
          );
        }, 90000);

        new window.DocsAPI!.DocEditor(editorId, {
          documentType,
          documentServerUrl,
          token,
          width: "100%",
          height: "100%",
          type: "desktop",
          events: {
            onDocumentReady: () => clearStuckTimer(),
            onError: (e: { data?: unknown }) => {
              clearStuckTimer();
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
        setError(e instanceof Error ? e.message : "Ошибка редактора");
      }
    };

    /** DocEditor заменяет placeholder на iframe — без пересоздания div повторный init (Strict Mode / смена token) не находит узел. */
    container.innerHTML = "";
    const ph = document.createElement("div");
    ph.id = editorId;
    ph.className = "h-full min-h-[480px] w-full";
    container.appendChild(ph);

    const existing = Array.from(document.querySelectorAll("script")).find(
      (s) => s.getAttribute("src") === scriptSrc
    );

    if (window.DocsAPI) {
      run();
      return () => {
        clearStuckTimer();
        container.innerHTML = "";
      };
    }

    if (existing) {
      const onLoad = () => run();
      existing.addEventListener("load", onLoad);
      if (window.DocsAPI) onLoad();
      return () => {
        clearStuckTimer();
        existing.removeEventListener("load", onLoad);
        container.innerHTML = "";
      };
    }

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = run;
    script.onerror = () => setError("Не удалось загрузить скрипт ONLYOFFICE");
    document.body.appendChild(script);

    return () => {
      clearStuckTimer();
      script.onload = null;
      script.onerror = null;
      container.innerHTML = "";
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
        ref={containerRef}
        className="min-h-[480px] flex-1 w-full overflow-hidden rounded-xl border border-border bg-background"
      />
    </div>
  );
}
