"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface DocumentChatDialogProps {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentChatDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: DocumentChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && fileId) {
      setLoading(true);
      setError(null);
      fetch(`/api/files/${fileId}/chat`)
        .then((r) => {
          if (!r.ok) throw new Error("Не удалось загрузить историю");
          return r.json();
        })
        .then((data) => setMessages(data.messages ?? []))
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setLoading(false));
    }
  }, [open, fileId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    try {
      const res = await fetch(`/api/files/${fileId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Ошибка отправки");
      }

      setMessages((prev) => [
        ...prev,
        { id: "user-" + Date.now(), role: "user", content, createdAt: new Date().toISOString() },
        { id: data.messageId, role: "assistant", content: data.content, createdAt: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-medium">
            Чат по документу: {fileName}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex min-h-[240px] max-h-[360px] flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Задайте вопрос по документу
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-0.5 ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface2 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(m.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Вопрос по документу..."
              disabled={sending}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" disabled={sending || !input.trim()} size="icon">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
