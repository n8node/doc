"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PublicInvite {
  id: string;
  code: string;
  status: string;
  isActive: boolean;
}

export default function PublicInvitesPage() {
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<PublicInvite[]>([]);

  useEffect(() => {
    fetch("/api/v1/public/invites")
      .then((r) => r.json())
      .then((data) => {
        setInvites(Array.isArray(data.invites) ? data.invites : []);
      })
      .catch(() => toast.error("Не удалось загрузить инвайты"))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Инвайт скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Инвайт-ключи</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Активные ключи можно использовать для регистрации.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Пока нет доступных инвайтов
          </p>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className={`flex items-center justify-between rounded-xl border border-border px-4 py-3 ${invite.isActive ? "bg-background" : "bg-surface2/30 opacity-60"}`}
              >
                <span className="font-mono text-sm">{invite.code}</span>
                {invite.isActive ? (
                  <button
                    type="button"
                    onClick={() => copyCode(invite.code)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Скопировать
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Неактивен</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
