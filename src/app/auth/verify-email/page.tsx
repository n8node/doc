"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

type VerifyState = "idle" | "loading" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const [state, setState] = useState<VerifyState>(token ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState("error");
          setMessage(data.error || "Не удалось подтвердить email");
          return;
        }

        if (typeof data.sessionToken === "string" && data.sessionToken) {
          const signInRes = await signIn("credentials", {
            email: "__telegram__",
            password: data.sessionToken,
            redirect: false,
          });
          if (!signInRes?.error) {
            router.replace("/dashboard");
            router.refresh();
            return;
          }
        }

        setState("success");
        setMessage("Email успешно подтверждён. Переходим в ваш аккаунт...");
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setMessage("Ошибка соединения. Попробуйте снова.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const description = useMemo(() => {
    if (token) return null;
    if (email) {
      return `Мы отправили ссылку подтверждения на ${email}. Откройте письмо и перейдите по ссылке.`;
    }
    return "Мы отправили ссылку подтверждения на ваш email. Откройте письмо и перейдите по ссылке.";
  }, [email, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="text-2xl font-bold text-foreground">Подтверждение email</h1>

        {state === "loading" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверяем ссылку...
          </div>
        )}

        {state === "idle" && (
          <p className="mt-4 text-sm text-muted-foreground">{message || description}</p>
        )}

        {state === "success" && <p className="mt-4 text-sm text-emerald-600">{message}</p>}

        {state === "error" && <p className="mt-4 text-sm text-error">{message}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {!token && !!email && (
            <button
              type="button"
              onClick={async () => {
                setResending(true);
                try {
                  const res = await fetch("/api/auth/verify-email/resend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setState("error");
                    setMessage(data.error || "Не удалось отправить письмо повторно");
                    return;
                  }
                  setState("idle");
                  setMessage("Письмо отправлено повторно. Проверьте входящие и папку Спам.");
                } finally {
                  setResending(false);
                }
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
              disabled={resending}
            >
              {resending ? "Отправка..." : "Отправить повторно"}
            </button>
          )}
          <Link
            href="/login"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Перейти ко входу
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            К регистрации
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
