"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useState, Suspense } from "react";
import { S3SettingsForm } from "@/components/admin/S3SettingsForm";
import { AiProvidersForm } from "@/components/admin/AiProvidersForm";

type Tab = "s3" | "yookassa" | "ai";

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? "s3");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        {(["s3", "yookassa", "ai"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            {t === "s3" ? "S3 хранилище" : t === "yookassa" ? "ЮKassa" : "AI-провайдеры"}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {tab === "s3" && <S3SettingsForm />}
        {tab === "yookassa" && (
          <div>
            <h2 className="text-lg font-semibold text-foreground">ЮKassa</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Настройки для приёма платежей
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Shop ID
                </label>
                <input
                  type="text"
                  placeholder=""
                  className="mt-1 w-full max-w-md rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Secret Key
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1 w-full max-w-md rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground"
                />
              </div>
              <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90">
                Тест API
              </button>
            </div>
          </div>
        )}
        {tab === "ai" && <AiProvidersForm />}
      </Card>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse rounded-xl border border-border bg-surface2 p-6">Загрузка...</div>}>
      <AdminSettingsContent />
    </Suspense>
  );
}
