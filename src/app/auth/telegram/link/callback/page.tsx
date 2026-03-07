"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function LinkCallbackContent() {
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
      const { id, hash: tgHash, auth_date, first_name, last_name, username, photo_url } = params;
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
      if (photo_url) initData.photo_url = photo_url;

      try {
        const res = await fetch("/api/v1/user/link-telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(initData),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Ошибка привязки");
          return;
        }

        router.push("/dashboard/settings?linked=telegram");
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
        <div className="space-y-4 text-center">
          <p className="text-error">{error}</p>
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="text-sm text-primary hover:underline"
          >
            Вернуться в настройки
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Привязка Telegram...
        </div>
      )}
    </main>
  );
}

export default function LinkCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <LinkCallbackContent />
    </Suspense>
  );
}
