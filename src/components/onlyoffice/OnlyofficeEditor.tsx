"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawFromDsRef = useRef(false);
  const rawLogCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const pushDebug = useCallback((line: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setDebugLines((prev) => [...prev.slice(-14), `${t} ${line}`]);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clearStuckTimer = () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current);
        stuckTimerRef.current = null;
      }
    };

    const clearHintTimer = () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };

    let dsOrigin = "";
    try {
      dsOrigin = new URL(documentServerUrl).origin;
    } catch {
      /* ignore */
    }

    const onWindowMessage = (ev: MessageEvent) => {
      if (!dsOrigin || ev.origin !== dsOrigin) return;
      rawFromDsRef.current = true;
      if (rawLogCountRef.current >= 12) return;
      rawLogCountRef.current += 1;
      const preview =
        typeof ev.data === "string"
          ? ev.data.slice(0, 220)
          : (() => {
              try {
                return JSON.stringify(ev.data).slice(0, 220);
              } catch {
                return "[object]";
              }
            })();
      pushDebug(`postMessage ← ${preview}`);
    };
    window.addEventListener("message", onWindowMessage);

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
        clearHintTimer();
        rawFromDsRef.current = false;
        rawLogCountRef.current = 0;
        pushDebug("DocEditor: init");
        hintTimerRef.current = setTimeout(() => {
          if (!rawFromDsRef.current) {
            pushDebug(
              "⚠ За 8 с нет postMessage от origin документ-сервера — проверьте Network (iframe), mixed content (HTTPS→HTTP), nginx: /web-apps/ и /coauthoring/ → onlyoffice."
            );
          }
          hintTimerRef.current = null;
        }, 8000);
        stuckTimerRef.current = setTimeout(() => {
          setError(
            "Документ не открылся за 90 с. Проверьте: 1) onlyoffice с ALLOW_PRIVATE_IP_ADDRESS=true и пересозданием контейнера 2) системный nginx: /coauthoring и /web-apps → onlyoffice 3) строки «Диагностика ONLYOFFICE» ниже — пришлите скрин."
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
            /** Не снимать таймер здесь: DS часто шлёт onDocumentReady до фактической загрузки файла — тогда красный текст не показывался. */
            onDocumentReady: () => pushDebug("onDocumentReady (iframe сообщил готовность)"),
            onDocumentStateChange: (e: { data?: unknown }) => {
              pushDebug(`onDocumentStateChange ${formatOoEvent(e?.data)}`);
            },
            onInfo: (e: { data?: unknown }) => {
              pushDebug(`onInfo ${formatOoEvent(e?.data)}`);
            },
            onError: (e: { data?: unknown }) => {
              clearStuckTimer();
              const t = formatOoEvent(e?.data);
              pushDebug(`onError ${t}`);
              setError(t || "Ошибка ONLYOFFICE (см. консоль iframe)");
            },
            onWarning: (e: { data?: unknown }) => {
              const t = formatOoEvent(e?.data);
              pushDebug(`onWarning ${t}`);
              if (t) console.warn("[ONLYOFFICE]", t);
            },
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка редактора");
      }
    };

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
        clearHintTimer();
        window.removeEventListener("message", onWindowMessage);
        container.innerHTML = "";
      };
    }

    if (existing) {
      const onLoad = () => run();
      existing.addEventListener("load", onLoad);
      if (window.DocsAPI) onLoad();
      return () => {
        clearStuckTimer();
        clearHintTimer();
        window.removeEventListener("message", onWindowMessage);
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
      clearHintTimer();
      window.removeEventListener("message", onWindowMessage);
      script.onload = null;
      script.onerror = null;
      container.innerHTML = "";
    };
  }, [documentServerUrl, token, documentType, editorId, pushDebug]);

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
      {debugLines.length > 0 && (
        <details className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Диагностика ONLYOFFICE (события с редактора)
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-muted-foreground">
            {debugLines.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
