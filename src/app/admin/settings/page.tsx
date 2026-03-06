"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useState, Suspense } from "react";
import { S3SettingsForm } from "@/components/admin/S3SettingsForm";
import { AiProvidersForm } from "@/components/admin/AiProvidersForm";
import { YookassaSettingsForm } from "@/components/admin/YookassaSettingsForm";
import { TelegramSettingsForm } from "@/components/admin/TelegramSettingsForm";

type Tab = "s3" | "yookassa" | "ai" | "telegram";

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? "s3");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        {(["s3", "yookassa", "ai", "telegram"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            {t === "s3" ? "S3 хранилище" : t === "yookassa" ? "ЮKassa" : t === "ai" ? "AI-провайдеры" : "Telegram"}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {tab === "s3" && <S3SettingsForm />}
        {tab === "yookassa" && <YookassaSettingsForm />}
        {tab === "ai" && <AiProvidersForm />}
        {tab === "telegram" && <TelegramSettingsForm />}
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
