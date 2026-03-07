"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface AuthMethods {
  emailRegistrationEnabled: boolean;
  telegramWidgetEnabled: boolean;
  telegramQrEnabled: boolean;
  telegramDomain: string;
  telegramBotUsername: string;
}

export function TelegramLoginBlock({
  methods,
  callbackUrl = "/dashboard",
}: {
  methods: AuthMethods;
  callbackUrl?: string;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const qrTokenRef = useRef<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"idle" | "pending" | "linked" | "expired">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!methods.telegramWidgetEnabled || !methods.telegramBotUsername || !widgetRef.current) return;

    const container = widgetRef.current;
    container.innerHTML = "";

    const cbUrl = searchParams.get("callbackUrl") || callbackUrl;
    const authUrl = `${window.location.origin}/auth/telegram/callback${cbUrl ? `?callbackUrl=${encodeURIComponent(cbUrl)}` : ""}`;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", methods.telegramBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);
  }, [methods.telegramWidgetEnabled, methods.telegramBotUsername, callbackUrl, searchParams]);

  const handleCreateQr = async () => {
    if (!methods.telegramQrEnabled) return;
    setQrStatus("idle");
    try {
      const res = await fetch("/api/auth/telegram/qr/create", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.token) {
        const token = data.token;
        qrTokenRef.current = token;
        setQrToken(token);
        setQrStatus("pending");
        pollRef.current = setInterval(pollStatus, 2000);
      }
    } catch {
      setQrStatus("idle");
    }
  };

  const pollStatus = async () => {
    const token = qrTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch(`/api/auth/telegram/qr/status?token=${token}`);
      const data = await res.json();
      if (data.status === "linked" && data.sessionToken) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setQrStatus("linked");
        const signInRes = await signIn("credentials", {
          email: "__telegram__",
          password: data.sessionToken,
          redirect: false,
        });
        if (!signInRes?.error) {
          router.push(searchParams.get("callbackUrl") || callbackUrl);
          router.refresh();
        }
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

  if (!methods.telegramWidgetEnabled && !methods.telegramQrEnabled) return null;

  return (
    <div className="space-y-4">
      {methods.telegramWidgetEnabled && methods.telegramBotUsername && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Войти через Telegram</p>
          <div ref={widgetRef} className="min-h-[40px]" />
        </div>
      )}

      {methods.telegramQrEnabled && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Войти по QR-коду</p>
          {qrStatus === "idle" && (
            <button
              type="button"
              onClick={handleCreateQr}
              className="rounded-xl border border-border bg-surface2 px-4 py-2 text-sm font-medium hover:bg-surface2/80"
            >
              Показать QR-код
            </button>
          )}
          {qrStatus === "pending" && qrToken && methods.telegramBotUsername && (
            <div className="flex flex-col items-center gap-2">
              <a
                href={`https://t.me/${methods.telegramBotUsername}?start=login_${qrToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border-2 border-primary bg-primary/10 px-6 py-3 text-sm font-medium text-primary hover:bg-primary/20"
              >
                Открыть в Telegram
              </a>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://t.me/${methods.telegramBotUsername}?start=login_${qrToken}`)}`}
                alt="QR для входа"
                width={200}
                height={200}
              />
              <p className="text-xs text-muted-foreground">Сканируйте QR или нажмите ссылку</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ожидание подтверждения...
              </div>
            </div>
          )}
          {qrStatus === "linked" && (
            <div className="flex items-center gap-2 text-emerald-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Вход...
            </div>
          )}
          {qrStatus === "expired" && (
            <button
              type="button"
              onClick={() => setQrStatus("idle")}
              className="text-sm text-muted-foreground hover:underline"
            >
              Обновить
            </button>
          )}
        </div>
      )}
    </div>
  );
}
