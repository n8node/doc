"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  fileId: string;
  documentServerUrl: string;
  token: string;
  documentType: string;
  /** База URL в JWT для скачивания файла (должна быть доступна из контейнера onlyoffice) */
  documentFetchBase: string;
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: Record<string, unknown>) => void;
    };
  }
}

/** Yandex Metrika и др. шлют postMessage с тем же origin, что и страница — не путать с ONLYOFFICE. */
function isOnlyofficeLikeMessage(data: unknown): boolean {
  if (data != null && typeof data === "object" && "event" in (data as object)) {
    return true;
  }
  if (typeof data !== "string") return false;
  if (data.startsWith("__ym")) return false;
  const t = data.trimStart();
  if (!t.startsWith("{") || !t.includes('"event"')) return false;
  try {
    const o = JSON.parse(data) as { event?: unknown };
    return typeof o.event === "string";
  } catch {
    return false;
  }
}

export function OnlyofficeEditor({
  fileId,
  documentServerUrl,
  token,
  documentType,
  documentFetchBase,
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
  const overlayPendingRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  /** Плейсхолдер поверх iframe, пока DS не подтвердил готовность (onAppReady / onDocumentReady / onInfo). */
  const [editorShellLoading, setEditorShellLoading] = useState(true);

  const pushDebug = useCallback((line: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setDebugLines((prev) => [...prev.slice(-14), `${t} ${line}`]);
  }, []);

  const dismissEditorShellLoading = useCallback(
    (reason: string) => {
      if (!overlayPendingRef.current) return;
      overlayPendingRef.current = false;
      setEditorShellLoading(false);
      pushDebug(reason);
    },
    [pushDebug]
  );

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
      if (!isOnlyofficeLikeMessage(ev.data)) return;
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
        dismissEditorShellLoading("DocsAPI отсутствует после загрузки скрипта");
        setError("ONLYOFFICE API не загружен");
        return;
      }
      const placeholder = document.getElementById(editorId);
      if (!placeholder) {
        dismissEditorShellLoading("placeholder редактора не найден в DOM");
        return;
      }
      try {
        clearStuckTimer();
        clearHintTimer();
        rawFromDsRef.current = false;
        rawLogCountRef.current = 0;
        overlayPendingRef.current = true;
        setEditorShellLoading(true);
        pushDebug(`DocEditor: init (DS качает файл с: ${documentFetchBase})`);
        hintTimerRef.current = setTimeout(() => {
          if (!rawFromDsRef.current) {
            pushDebug(
              "⚠ За 8 с нет postMessage от origin документ-сервера — проверьте Network (iframe), mixed content (HTTPS→HTTP), nginx: /web-apps/ и /coauthoring/ → onlyoffice."
            );
          }
          hintTimerRef.current = null;
        }, 8000);
        stuckTimerRef.current = setTimeout(() => {
          dismissEditorShellLoading(
            "таймаут 90 с: скрытие оверлея для диагностики (ошибка ниже)"
          );
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
            /** Снимает оверлей раньше onDocumentReady — у части инсталляций onDocumentReady не доходит до родителя. */
            onAppReady: () => {
              dismissEditorShellLoading("onAppReady (приложение редактора загружено)");
            },
            onDocumentReady: () => {
              dismissEditorShellLoading("onDocumentReady (документ в редакторе)");
            },
            onDocumentStateChange: (e: { data?: unknown }) => {
              pushDebug(`onDocumentStateChange ${formatOoEvent(e?.data)}`);
            },
            onInfo: (e: { data?: unknown }) => {
              pushDebug(`onInfo ${formatOoEvent(e?.data)}`);
              dismissEditorShellLoading("onInfo (файл открыт в редакторе)");
            },
            onError: (e: { data?: unknown }) => {
              clearStuckTimer();
              dismissEditorShellLoading("onError");
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
        dismissEditorShellLoading("исключение при создании DocEditor");
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
    script.onerror = () => {
      dismissEditorShellLoading("не загрузился api.js ONLYOFFICE");
      setError("Не удалось загрузить скрипт ONLYOFFICE");
    };
    document.body.appendChild(script);

    return () => {
      clearStuckTimer();
      clearHintTimer();
      window.removeEventListener("message", onWindowMessage);
      script.onload = null;
      script.onerror = null;
      container.innerHTML = "";
    };
  }, [
    documentServerUrl,
    token,
    documentType,
    documentFetchBase,
    editorId,
    pushDebug,
    dismissEditorShellLoading,
  ]);

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[480px] w-full flex-col">
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="relative min-h-[480px] flex-1 w-full overflow-hidden rounded-xl border border-border bg-background">
        <div
          ref={containerRef}
          className="absolute inset-0 min-h-[480px] h-full w-full"
        />
        {editorShellLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col gap-2 bg-background p-4"
            aria-busy
            aria-label="Загрузка редактора"
          >
            <Skeleton className="h-9 w-full max-w-xl" />
            <Skeleton className="min-h-[420px] flex-1 w-full rounded-lg" />
          </div>
        )}
      </div>
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
