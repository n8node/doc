"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Search,
  MessageCircle,
  BrainCircuit,
  Database,
  Key,
  Upload,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorageWidget } from "@/components/dashboard/StorageWidget";
import { buildDashboardFilesUrl } from "@/lib/files-navigation";
import type { DashboardContent } from "@/lib/dashboard-content";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  files: FolderOpen,
  search: Search,
  chat: MessageCircle,
  rag: BrainCircuit,
  embeddings: Database,
  api: Key,
};

function getDashboardAssetUrl(imageId: string): string {
  return `/api/public/dashboard-asset/${imageId}`;
}

function CardWithImage({
  card,
  Icon,
  getAssetUrl,
  href,
}: {
  card: { id: string; title: string; description: string; href: string; cta: string; imageKey?: string | null };
  Icon: React.ComponentType<{ className?: string }>;
  getAssetUrl: (id: string) => string;
  href: string;
}) {
  const [imgError, setImgError] = useState(false);
  const showImg = card.imageKey && !imgError;

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.99 }}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface2/40 transition-colors hover:border-primary/40 hover:bg-surface2/70 hover:shadow-lg"
      >
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex items-start justify-between">
            {showImg ? (
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-border bg-background">
                <img
                  src={getAssetUrl(card.imageKey!)}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-7 w-7" />
              </div>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">{card.title}</h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-2">
            {card.description}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-fit group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary"
          >
            {card.cta}
          </Button>
        </div>
      </motion.div>
    </Link>
  );
}

export function DashboardOverview() {
  const router = useRouter();
  const [content, setContent] = useState<DashboardContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/dashboard-content")
      .then((r) => r.json())
      .then((data) => setContent(data))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !content) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleQuickUpload = () => {
    router.push(buildDashboardFilesUrl({ section: "my-files", intent: "upload" }));
  };

  const handleQuickSearch = () => {
    router.push("/dashboard/search");
  };

  const handleQuickChat = () => {
    router.push("/dashboard/document-chats");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface2/80 to-surface/80 p-8 shadow-lg"
      >
        {content.heroImageKey && (
          <div className="pointer-events-none absolute inset-0 opacity-15">
            <img
              src={getDashboardAssetUrl("hero")}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="relative">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            {content.heroTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {content.heroSubtitle}
          </p>
        </div>
      </motion.section>

      {/* How it works */}
      {content.steps.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className="mb-4 text-lg font-semibold text-foreground">Как это работает</h2>
          <div className="flex flex-wrap items-stretch gap-4">
            {content.steps.map((step, i) => (
              <div
                key={i}
                className="relative flex min-w-[200px] flex-1 basis-[200px] flex-col rounded-2xl border border-border bg-surface2/50 p-5"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
                {i < content.steps.length - 1 && (
                  <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-muted-foreground/50 sm:inline">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Tool cards */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">Инструменты</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content.cards.map((card) => {
            const Icon = ICON_MAP[card.id] ?? FolderOpen;
            return (
              <CardWithImage
                key={card.id}
                card={card}
                Icon={Icon}
                getAssetUrl={getDashboardAssetUrl}
                href={card.href}
              />
            );
          })}
        </div>
      </motion.section>

      {/* Quick actions */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">Быстрые действия</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleQuickUpload}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            <Upload className="mr-2 h-4 w-4" />
            {content.quickUploadLabel}
          </Button>
          <Button variant="outline" onClick={handleQuickSearch}>
            <Search className="mr-2 h-4 w-4" />
            {content.quickSearchLabel}
          </Button>
          <Button variant="outline" onClick={handleQuickChat}>
            <MessageCircle className="mr-2 h-4 w-4" />
            {content.quickChatLabel}
          </Button>
        </div>
      </motion.section>

      {/* Storage widget */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">Ваш аккаунт</h2>
        <div className="max-w-md">
          <StorageWidget />
        </div>
      </motion.section>
    </div>
  );
}
