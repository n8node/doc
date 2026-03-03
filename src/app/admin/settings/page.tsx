"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

type Tab = "s3" | "yookassa" | "ai";

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? "s3");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(["s3", "yookassa", "ai"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t === "s3" ? "S3 хранилище" : t === "yookassa" ? "ЮKassa" : "AI-провайдеры"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {tab === "s3" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              S3-совместимое хранилище
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Yandex Cloud, SberCloud, Selectel
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Endpoint
                </label>
                <input
                  type="text"
                  placeholder="https://storage.yandexcloud.net"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Bucket
                </label>
                <input
                  type="text"
                  placeholder="my-bucket"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800"
                />
              </div>
              <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                Тест подключения
              </button>
            </div>
          </div>
        )}
        {tab === "yookassa" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800">ЮKassa</h2>
            <p className="mt-2 text-sm text-slate-500">
              Настройки для приёма платежей
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Shop ID
                </label>
                <input
                  type="text"
                  placeholder=""
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Secret Key
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800"
                />
              </div>
              <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                Тест API
              </button>
            </div>
          </div>
        )}
        {tab === "ai" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              AI-провайдеры
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              YandexGPT, GigaChat, Ollama и др.
            </p>
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
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
    <Suspense fallback={<div className="animate-pulse rounded-xl border bg-slate-100 p-6">Загрузка...</div>}>
      <AdminSettingsContent />
    </Suspense>
  );
}
