"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useState, Suspense } from "react";
import { S3SettingsForm } from "@/components/admin/S3SettingsForm";
import { AiProvidersForm } from "@/components/admin/AiProvidersForm";
import { PaymentsSettingsTab } from "@/components/admin/PaymentsSettingsTab";
import { TelegramSettingsForm } from "@/components/admin/TelegramSettingsForm";
import { AuthSettingsForm } from "@/components/admin/AuthSettingsForm";
import { EmailSettingsForm } from "@/components/admin/EmailSettingsForm";
import { BrandingSettingsForm } from "@/components/admin/BrandingSettingsForm";
import { MarketplaceOpenRouterForm } from "@/components/admin/MarketplaceOpenRouterForm";
import { MarketplaceOpenRouterActivityForm } from "@/components/admin/MarketplaceOpenRouterActivityForm";
import { MarketplaceMarginForm } from "@/components/admin/MarketplaceMarginForm";
import { SeoSettingsForm } from "@/components/admin/SeoSettingsForm";
import { FooterSettingsForm } from "@/components/admin/FooterSettingsForm";
import { HeaderNavSettingsForm } from "@/components/admin/HeaderNavSettingsForm";
import { YandexMetrikaSettingsForm } from "@/components/admin/YandexMetrikaSettingsForm";

type Tab =
  | "s3"
  | "payments"
  | "ai"
  | "marketplace"
  | "telegram"
  | "auth"
  | "email"
  | "branding"
  | "seo"
  | "header"
  | "footer"
  | "analytics";

function normalizeSettingsTab(t: string | null): Tab | null {
  if (!t) return null;
  if (t === "yookassa") return "payments";
  return t as Tab;
}

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = normalizeSettingsTab(searchParams.get("tab"));
  const [tab, setTab] = useState<Tab>(tabParam ?? "branding");

  const tabLabels: Record<Tab, string> = {
    branding: "Брендинг",
    seo: "SEO",
    header: "Шапка",
    footer: "Футер",
    analytics: "Яндекс.Метрика",
    auth: "Авторизация",
    email: "Email / SMTP",
    s3: "S3 хранилище",
    payments: "Платежи",
    ai: "AI-провайдеры",
    marketplace: "Маркетплейс",
    telegram: "Telegram",
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        {(
          [
            "branding",
            "seo",
            "header",
            "footer",
            "analytics",
            "auth",
            "email",
            "s3",
            "payments",
            "ai",
            "marketplace",
            "telegram",
          ] as const
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface2"
            }`}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {tab === "branding" && <BrandingSettingsForm />}
        {tab === "seo" && <SeoSettingsForm />}
        {tab === "header" && <HeaderNavSettingsForm />}
        {tab === "footer" && <FooterSettingsForm />}
        {tab === "analytics" && <YandexMetrikaSettingsForm />}
        {tab === "s3" && <S3SettingsForm />}
        {tab === "payments" && <PaymentsSettingsTab />}
        {tab === "ai" && <AiProvidersForm />}
        {tab === "marketplace" && (
          <div className="space-y-10">
            <MarketplaceMarginForm />
            <hr className="border-border" />
            <MarketplaceOpenRouterForm />
            <MarketplaceOpenRouterActivityForm />
          </div>
        )}
        {tab === "telegram" && <TelegramSettingsForm />}
        {tab === "auth" && <AuthSettingsForm />}
        {tab === "email" && <EmailSettingsForm />}
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
