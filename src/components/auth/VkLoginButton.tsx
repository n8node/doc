"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type VkMode = "login" | "register" | "link";

interface VkLoginButtonProps {
  mode: VkMode;
  /** Для mode=register при включённых инвайтах — проверенный код */
  inviteCode?: string;
  callbackUrl?: string;
  className?: string;
  label?: string;
}

export function VkLoginButton({
  mode,
  inviteCode,
  callbackUrl = "/dashboard",
  className = "",
  label,
}: VkLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const provRes = await fetch("/api/auth/providers", { credentials: "include" });
      const providers = await provRes.json().catch(() => null);
      if (!providers || typeof providers !== "object" || !("vk" in providers)) {
        toast.error(
          "Вход через VK не подключён: в админке (Авторизация) укажите ID и защищённый ключ приложения VK и включите опцию."
        );
        return;
      }

      const res = await fetch("/api/auth/oauth-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          ...(inviteCode ? { inviteCode } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && mode === "link") {
          throw new Error("Сессия не найдена. Обновите страницу и войдите снова, затем повторите привязку.");
        }
        throw new Error((data as { error?: string }).error ?? "Ошибка подготовки входа");
      }
      await signIn("vk", { callbackUrl, redirect: true });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Не удалось начать вход через VK");
    } finally {
      setLoading(false);
    }
  }

  const defaultLabel =
    mode === "register" ? "Зарегистрироваться через VK" : mode === "link" ? "Привязать VK" : "Войти через VK";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0077FF] px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-[#0066dd] disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.253-1.405 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.033-2.303 4.031-2.303 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.202 1.253.745.847 1.32 1.558 1.473 2.05.17.491-.085.744-.576.744z" />
        </svg>
      )}
      {label ?? defaultLabel}
    </button>
  );
}
