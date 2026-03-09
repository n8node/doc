"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, HardDrive, UserPlus } from "lucide-react";
import { TelegramLoginBlock } from "@/components/auth/TelegramLoginBlock";

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const strengthLabels = ["", "Слабый", "Средний", "Хороший", "Сильный"];
const strengthColors = ["", "bg-error", "bg-warning", "bg-primary", "bg-success"];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [inviteVerifiedCode, setInviteVerifiedCode] = useState("");
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [authMethods, setAuthMethods] = useState<{
    emailRegistrationEnabled: boolean;
    inviteRegistrationEnabled: boolean;
    telegramWidgetEnabled: boolean;
    telegramQrEnabled: boolean;
    telegramDomain: string;
    telegramBotUsername: string;
    siteName: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then(setAuthMethods)
      .catch(() => setAuthMethods({
        emailRegistrationEnabled: true,
        inviteRegistrationEnabled: false,
        telegramWidgetEnabled: false,
        telegramQrEnabled: false,
        telegramDomain: "qoqon.ru",
        telegramBotUsername: "",
        siteName: "qoqon.ru",
      }));
  }, []);

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (authMethods?.inviteRegistrationEnabled && !inviteVerifiedCode) {
      setError("Сначала активируйте регистрацию по инвайт-ключу");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
          inviteCode: authMethods?.inviteRegistrationEnabled ? inviteVerifiedCode : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка регистрации");
        return;
      }

      if (data.requiresEmailVerification) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      router.push("/login");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCheckingInvite(true);
    try {
      const res = await fetch("/api/auth/invite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCodeInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Инвайт недействителен");
        return;
      }
      setInviteVerifiedCode(data.inviteCode || inviteCodeInput.trim());
    } catch {
      setError("Ошибка проверки инвайт-ключа");
    } finally {
      setCheckingInvite(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <HardDrive className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Создать аккаунт</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Облачное хранилище {authMethods?.siteName || "qoqon.ru"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
          {authMethods && !authMethods.inviteRegistrationEnabled && (authMethods.telegramWidgetEnabled || authMethods.telegramQrEnabled) && (
            <div className={`flex flex-col items-center gap-4 text-center ${authMethods.emailRegistrationEnabled !== false ? "mb-6 border-b border-border pb-6" : ""}`}>
              <p className="text-sm text-muted-foreground">Зарегистрируйтесь через Telegram</p>
              <TelegramLoginBlock methods={authMethods} callbackUrl="/dashboard" />
            </div>
          )}
          {authMethods?.emailRegistrationEnabled !== false && authMethods?.inviteRegistrationEnabled && !inviteVerifiedCode && (
          <form onSubmit={handleVerifyInvite}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-5 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Инвайт-ключ
              </label>
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                required
                placeholder="QoQon_XXXXXXXXXXXX"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={checkingInvite}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-medium disabled:opacity-60"
            >
              {checkingInvite ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                "Продолжить"
              )}
            </button>
          </form>
          )}

          {authMethods?.emailRegistrationEnabled !== false && (!authMethods?.inviteRegistrationEnabled || !!inviteVerifiedCode) && (
          <form onSubmit={handleSubmit}>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-5 rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error"
            >
              {error}
            </motion.div>
          )}

          {authMethods?.inviteRegistrationEnabled && inviteVerifiedCode && (
            <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
              Инвайт активирован: <span className="font-semibold">{inviteVerifiedCode}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Имя <span className="text-muted-foreground">(необязательно)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Минимум 8 символов"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          level <= strength ? strengthColors[strength] : "bg-surface2"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs ${strength <= 1 ? "text-error" : strength <= 2 ? "text-warning" : "text-success"}`}>
                    {strengthLabels[strength]}
                    {strength < 3 && " — добавьте заглавные буквы, цифры, спецсимволы"}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Повторите пароль
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Повторите пароль"
                className={`w-full rounded-xl border bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                  confirmPassword && confirmPassword !== password
                    ? "border-error focus:border-error focus:ring-error/20"
                    : "border-border focus:border-primary focus:ring-primary/20"
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-error">Пароли не совпадают</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-medium disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Создание аккаунта...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Зарегистрироваться
              </>
            )}
          </button>
          </form>
          )}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Войти
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Регистрируясь, вы получаете бесплатный тариф с 25 ГБ хранилища
        </p>
      </motion.div>
    </main>
  );
}
