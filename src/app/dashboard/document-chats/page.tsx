"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentChatCard, type DocumentChatItem } from "@/components/files/DocumentChatCard";
import { DocumentChatDialog } from "@/components/files/DocumentChatDialog";

export default function DocumentChatsPage() {
  const [items, setItems] = useState<DocumentChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatTarget, setChatTarget] = useState<{ fileId: string; fileName: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/document-chats");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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
