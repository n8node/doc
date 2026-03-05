"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageCircle, Loader2, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentChatCard, type DocumentChatItem } from "@/components/files/DocumentChatCard";
import { DocumentChatDialog } from "@/components/files/DocumentChatDialog";

export default function DocumentChatsPage() {
  const [items, setItems] = useState<DocumentChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [chatTarget, setChatTarget] = useState<{ fileId: string; fileName: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, chatsRes] = await Promise.all([
        fetch("/api/v1/plans/me"),
        fetch("/api/v1/user/document-chats"),
      ]);
      const planData = await planRes.json();
      setAllowed(!!planData.features?.document_chat);

      if (!planData.features?.document_chat) {
        setItems([]);
        return;
      }
      const chatsData = await chatsRes.json();
      setItems(chatsData.items ?? []);
    } catch {
      setAllowed(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (loading && allowed === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI чаты по документам</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Функция недоступна на вашем тарифе.
          </p>
        </div>
        <Card className="border-border bg-surface">
          <CardContent className="py-16 text-center">
            <Crown className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Обновите тариф</p>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              AI чаты по документам доступны на платных тарифах. Выберите подходящий тариф, чтобы начать диалоги с документами.
            </p>
            <Link
              href="/dashboard/plans"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Выбрать тариф
              <span aria-hidden>→</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI чаты по документам</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Документы, с которыми вы вели диалог. Нажмите на карточку, чтобы продолжить обсуждение.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="py-16 text-center">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Нет чатов</p>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Откройте документ в разделе «Мои файлы», обработайте его и нажмите «Чат», чтобы начать диалог.
              Здесь появятся все документы, с которыми вы уже общались.
            </p>
            <a
              href="/dashboard/files"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Перейти к файлам
              <span aria-hidden>→</span>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <DocumentChatCard
              key={item.fileId}
              item={item}
              index={index}
              onClick={() => setChatTarget({ fileId: item.fileId, fileName: item.fileName })}
            />
          ))}
        </div>
      )}

      {chatTarget && (
        <DocumentChatDialog
          fileId={chatTarget.fileId}
          fileName={chatTarget.fileName}
          open={!!chatTarget}
          onOpenChange={(open) => !open && setChatTarget(null)}
        />
      )}
    </div>
  );
}
