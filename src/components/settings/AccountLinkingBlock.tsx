"use client";

import { useEffect, useRef, useState } from "react";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface AccountLinking {
  canLinkTelegram: boolean;
  canLinkEmail: boolean;
  hasTelegram: boolean;
  isPlaceholderEmail: boolean;
  pendingEmailVerification?: {
    email: string | null;
    expiresAt: string;
  } | null;
}

interface AuthMethods {
  telegramWidgetEnabled: boolean;
  telegramQrEnabled: boolean;
  telegramBotUsername: string;
}

interface AccountLinkingBlockProps {
  accountLinking: AccountLinking;
  onLinked: () => void;
}

export function AccountLinkingBlock({ accountLinking, onLinked }: AccountLinkingBlockProps) {
  const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"idle" | "pending" | "linked" | "expired">("idle");
  const qrTokenRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((data) =>
        setAuthMethods({
          telegramWidgetEnabled: data.telegramWidgetEnabled === true,
          telegramQrEnabled: data.telegramQrEnabled === true,
          telegramBotUsername: data.telegramBotUsername || "",
        })
      )
      .catch(() => setAuthMethods(null));
  }, []);

  useEffect(() => {
    if (
      accountLinking.canLinkTelegram &&
      authMethods?.telegramWidgetEnabled &&
      authMethods.telegramBotUsername &&
      widgetRef.current
    ) {
      const container = widgetRef.current;
      container.innerHTML = "";
      const authUrl = `${window.location.origin}/auth/telegram/link/callback`;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", authMethods.telegramBotUsername);
      script.setAttribute("data-size", "medium");
      script.setAttribute("data-auth-url", authUrl);
      script.setAttribute("data-request-access", "write");
      container.appendChild(script);
    }
  }, [accountLinking.canLinkTelegram, authMethods?.telegramWidgetEnabled, authMethods?.telegramBotUsername]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCreateQr = async () => {
    if (!authMethods?.telegramQrEnabled) return;
    setQrStatus("idle");
    try {
      const res = await fetch("/api/auth/telegram/qr/create-link", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.token) {
        const token = data.token;
        qrTokenRef.current = token;
        setQrToken(token);
        setQrStatus("pending");
        pollRef.current = setInterval(pollStatus, 2000);
      } else {
        toast.error(data.error || "Ошибка создания QR");
      }
    } catch {
      setQrStatus("idle");
    }
  };

  const pollStatus = async () => {
    const token = qrTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch(`/api/auth/telegram/qr/status?token=${token}`, { credentials: "include" });
      const data = await res.json();
      if (data.status === "linked") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setQrStatus("linked");
        onLinked();
        toast.success("Telegram привязан");
      } else if (data.status === "expired") {
        if (pollRef.current) clearInterval(pollRef.current);
        setQrStatus("expired");
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (qrToken && qrStatus === "pending") {
      pollStatus();
    }
  }, [qrToken, qrStatus]);

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEmail.trim() || linkPassword.length < 8) {
      toast.error("Введите email и пароль (не менее 8 символов)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/user/link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkEmail.trim(), password: linkPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      toast.success("Письмо отправлено. Подтвердите email для завершения привязки.");
      setLinkEmail("");
      setLinkPassword("");
      onLinked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка привязки");
    } finally {
      setSaving(false);
    }
  };

  const nothingToShow = !accountLinking.canLinkTelegram && !accountLinking.canLinkEmail;
  const bothLinked = accountLinking.hasTelegram && !accountLinking.isPlaceholderEmail;

  const subtitle =
    bothLinked
      ? "Вход доступен по email и Telegram"
      : accountLinking.canLinkEmail && accountLinking.canLinkTelegram
        ? "Привяжите Telegram или email для входа разными способами"
        : accountLinking.canLinkEmail
          ? "Привяжите email для входа по паролю"
          : "Привяжите Telegram для входа по QR и кнопке";

  if (nothingToShow && !bothLinked) return null;

  return (
    <div className="rounded-2xl modal-glass overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Привязка аккаунтов
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {subtitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {bothLinked && (
          <p className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Email и Telegram привязаны. Вход доступен обоими способами.
          </p>
        )}

        {accountLinking.canLinkTelegram && (
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Привязать Telegram
            </p>
            <p className="text-xs text-muted-foreground">
              Вход по QR-коду и кнопке «Войти через Telegram»
            </p>
            <div className="flex flex-wrap gap-4 items-start">
              {authMethods?.telegramWidgetEnabled && authMethods.telegramBotUsername && (
                <div ref={widgetRef} className="min-h-[40px]" />
              )}
              {authMethods?.telegramQrEnabled && authMethods?.telegramBotUsername && (
                <div className="flex flex-col gap-2">
                  {qrStatus === "idle" && (
                    <Button variant="outline" size="sm" onClick={handleCreateQr}>
                      Показать QR-код
                    </Button>
                  )}
                  {qrStatus === "pending" && qrToken && (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://t.me/${authMethods.telegramBotUsername}?start=link_${qrToken}`)}`}
                        alt="QR для привязки"
                        width={150}
                        height={150}
                      />
                      <a
                        href={`https://t.me/${authMethods.telegramBotUsername}?start=link_${qrToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Открыть в Telegram
                      </a>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Сканируйте QR и нажмите Start
                      </div>
                    </div>
                  )}
                  {qrStatus === "linked" && (
                    <span className="text-sm text-emerald-600">Привязано</span>
                  )}
                  {qrStatus === "expired" && (
                    <Button variant="ghost" size="sm" onClick={() => setQrStatus("idle")}>
                      Обновить
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {accountLinking.canLinkEmail && (
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Привязать email
            </p>
            <p className="text-xs text-muted-foreground">
              Вход по паролю. Сначала подтвердите email из письма, после этого вход по паролю станет доступен.
            </p>
            {accountLinking.pendingEmailVerification && (
              <div className="rounded-lg bg-primary/10 px-4 py-2 text-xs text-primary space-y-2">
                <p>
                  Ожидает подтверждения: {accountLinking.pendingEmailVerification.email || "email не указан"} до{" "}
                  {new Date(accountLinking.pendingEmailVerification.expiresAt).toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/v1/user/link-email/resend", { method: "POST" });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
                      toast.success("Письмо отправлено повторно");
                      onLinked();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
                    }
                  }}
                >
                  Отправить письмо повторно
                </Button>
              </div>
            )}
            <form onSubmit={handleLinkEmail} className="flex flex-col gap-3 max-w-sm">
              <Input
                type="email"
                placeholder="your@email.com"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Пароль (мин. 8 символов)"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Привязать email
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </div>
  );
}
