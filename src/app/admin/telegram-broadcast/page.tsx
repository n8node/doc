"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";

export default function AdminTelegramBroadcastPage() {
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "document" | "video" | "">("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
  } | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/telegram/broadcast", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUserCount(data.count ?? null))
      .catch(() => setUserCount(null));
  }, []);

  const handleSend = async () => {
    if (!text.trim() && !mediaUrl.trim()) {
      toast.error("Укажите текст и/или ссылку на медиа");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/admin/telegram/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: text.trim() || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaType || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setResult({ total: data.total, sent: data.sent, failed: data.failed });
      toast.success(`Отправлено: ${data.sent} из ${data.total}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка рассылки");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Telegram-рассылка</h1>
        <p className="mt-1 text-muted-foreground">
          Массовая рассылка всем пользователям с привязанным Telegram
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Получатели
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {userCount !== null
              ? `Пользователей с привязанным Telegram: ${userCount}`
              : "Загрузка..."}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сообщение</CardTitle>
          <p className="text-sm text-muted-foreground">
            Текст обязателен. Медиа — опционально (photo, document или video)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Текст</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Текст сообщения..."
              rows={4}
              className="w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ссылка на медиа (опционально)</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full max-w-2xl rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Тип медиа</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as "photo" | "document" | "video" | "")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Без медиа</option>
              <option value="photo">Фото</option>
              <option value="document">Документ</option>
              <option value="video">Видео</option>
            </select>
          </div>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Отправить рассылку
              </>
            )}
          </Button>
          {result && (
            <div className="rounded-lg border border-border bg-surface2 p-4">
              <p className="text-sm">
                Всего: {result.total} • Отправлено: {result.sent} • Ошибок: {result.failed}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
