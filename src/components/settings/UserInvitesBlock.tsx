"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface InviteItem {
  id: string;
  code: string;
  status: string;
  isActive: boolean;
}

export function UserInvitesBlock() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [invites, setInvites] = useState<InviteItem[]>([]);

  useEffect(() => {
    fetch("/api/v1/user/invites")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.inviteRegistrationEnabled === true);
        setInvites(Array.isArray(data.invites) ? data.invites : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Мои инвайты</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка...
        </CardContent>
      </div>
    );
  }

  if (!enabled) {
    return null;
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Инвайт скопирован");
    } catch {
      toast.error("Не удалось скопировать инвайт");
    }
  };

  return (
    <div className="rounded-2xl modal-glass overflow-hidden">
      <CardHeader>
        <CardTitle>Мои инвайты</CardTitle>
        <p className="text-sm text-muted-foreground">
          Делитесь ключами для регистрации новых пользователей.
        </p>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">У вас пока нет инвайтов.</p>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className={`flex items-center justify-between rounded-xl border border-border px-3 py-2 ${invite.isActive ? "" : "opacity-60"}`}
              >
                <span className="font-mono text-sm">{invite.code}</span>
                {invite.isActive ? (
                  <button
                    type="button"
                    onClick={() => copyCode(invite.code)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Скопировать
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">{invite.status}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </div>
  );
}
