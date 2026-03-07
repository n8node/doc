"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

function TelegramCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (typeof window === "undefined") return;

      const hashPart = window.location.hash.slice(1);
      const queryPart = window.location.search.slice(1);
      const paramString = hashPart || queryPart;
      if (!paramString) {
        setError("Нет данных от Telegram");
        return;
      }

      const params = Object.fromEntries(new URLSearchParams(paramString));
      const { id, hash: tgHash, auth_date, first_name, last_name, username } = params;
      if (!id || !tgHash) {
        setError("Неполные данные");
        return;
      }

      const initData: Record<string, string> = {
        id,
        hash: tgHash,
        auth_date,
        first_name: first_name || "",
        last_name: last_name || "",
        username: username || "",
      };

      try {
        const res = await fetch("/api/auth/telegram/widget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initData),
        });
        const data = await res.json();

        if (!res.ok || !data.sessionToken) {
          setError(data.error || "Ошибка авторизации");
          return;
        }

        const signInRes = await signIn("credentials", {
          email: "__telegram__",
          password: data.sessionToken,
          redirect: false,
        });

        if (signInRes?.error) {
          setError("Ошибка входа");
          return;
        }

        const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError("Ошибка соединения");
      }
    };

    run();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {error ? (
        <p className="text-error">{error}</p>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Вход через Telegram...
        </div>
      )}
    </main>
  );
}

export default function TelegramCallbackPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    }>
      <TelegramCallbackContent />
    </Suspense>
  );
}
