"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

type Tab = "s3" | "yookassa" | "ai";

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? "s3");

  return (
    <div>
      <h1 className="text-2xl font-bold">Настройки системы</h1>

      <div className="mt-4 flex gap-2 border-b">
        {(["s3", "yookassa", "ai"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 ${
              tab === t ? "border-primary font-medium" : "border-transparent"
            }`}
          >
            {t === "s3" ? "S3 хранилище" : t === "yookassa" ? "ЮKassa" : "AI-провайдеры"}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-lg border p-6">
        {tab === "s3" && (
          <div>
            <h2 className="font-semibold">S3-совместимое хранилище</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Yandex Cloud, SberCloud, Selectel
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm">Endpoint</label>
                <input
                  type="text"
                  placeholder="https://storage.yandexcloud.net"
                  className="mt-1 w-full max-w-md rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm">Bucket</label>
                <input
                  type="text"
                  placeholder="my-bucket"
                  className="mt-1 w-full max-w-md rounded border px-3 py-2"
                />
              </div>
              <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
                Тест подключения
              </button>
            </div>
          </div>
        )}
        {tab === "yookassa" && (
          <div>
            <h2 className="font-semibold">ЮKassa</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Настройки для приёма платежей
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm">Shop ID</label>
                <input
                  type="text"
                  placeholder=""
                  className="mt-1 w-full max-w-md rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm">Secret Key</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1 w-full max-w-md rounded border px-3 py-2"
                />
              </div>
              <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
                Тест API
              </button>
            </div>
          </div>
        )}
        {tab === "ai" && (
          <div>
            <h2 className="font-semibold">AI-провайдеры</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              YandexGPT, GigaChat, Ollama и др.
            </p>
            <div className="mt-4 rounded border p-4">
              <p className="text-sm text-muted-foreground">
                Добавление и управление AI-провайдерами через API админки.
                Эндпоинты: GET/POST /api/admin/ai/providers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <AdminSettingsContent />
    </Suspense>
  );
}
