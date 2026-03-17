"use client";

import { useEffect } from "react";
import type { YandexMetrikaConfig } from "@/lib/yandex-metrika";

const TAG_SCRIPT_URL = "https://mc.yandex.ru/metrika/tag.js";

declare global {
  interface Window {
    ym?: (id: number, action: string, params?: Record<string, unknown>) => void;
  }
}

type Props = { config: YandexMetrikaConfig };

function buildInitParams(config: YandexMetrikaConfig): Record<string, unknown> {
  return {
    ssr: true,
    webvisor: config.webvisor,
    clickmap: config.clickmap,
    ecommerce: config.ecommerce || "dataLayer",
    referrer: typeof document !== "undefined" ? document.referrer : "",
    url: typeof location !== "undefined" ? location.href : "",
    accurateTrackBounce: config.accurateTrackBounce,
    trackLinks: config.trackLinks,
  };
}

export function YandexMetrikaInjector({ config }: Props) {
  useEffect(() => {
    const counterId = config.counterId?.trim();
    if (!counterId || !/^\d+$/.test(counterId)) return;

    const id = Number(counterId);
    const initParams = buildInitParams(config);

    // Очередь вызовов до загрузки tag.js (как в оригинальном коде Яндекс.Метрики)
    const ymStub = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      ((ymStub as unknown as { a: unknown[] }).a = (ymStub as unknown as { a: unknown[] }).a || []).push(arguments);
    } as Window["ym"];
    (ymStub as unknown as { a: unknown[] }).a = [];
    (ymStub as unknown as { l: number }).l = Date.now();
    window.ym = ymStub;

    // Не подключать скрипт повторно
    for (let j = 0; j < document.scripts.length; j++) {
      const src = (document.scripts[j] as HTMLScriptElement).src;
      if (src === TAG_SCRIPT_URL || src.startsWith(`${TAG_SCRIPT_URL}?`)) {
        (window.ym as NonNullable<Window["ym"]>)(id, "init", initParams);
        return;
      }
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `${TAG_SCRIPT_URL}?id=${id}`;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
    (window.ym as NonNullable<Window["ym"]>)(id, "init", initParams);
  }, [config]);

  const counterId = config.counterId?.trim();
  if (!counterId || !/^\d+$/.test(counterId)) return null;

  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${counterId}`}
          style={{ position: "absolute", left: -9999 }}
          alt=""
        />
      </div>
    </noscript>
  );
}
