"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function RobokassaSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [values, setValues] = useState({
    merchantLogin: "",
    password1: "",
    password2: "",
    isTest: false,
  });
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/robokassa")
      .then((r) => r.json())
      .then((data) => {
        if (data.merchantLogin) {
          setValues((v) => ({ ...v, merchantLogin: data.merchantLogin }));
        }
        if (typeof data.isTest === "boolean") {
          setValues((v) => ({ ...v, isTest: data.isTest }));
        }
        if (data.password1Set) {
          setValues((v) => ({ ...v, password1: "••••••••" }));
        }
        if (data.password2Set) {
          setValues((v) => ({ ...v, password2: "••••••••" }));
        }
        if (data.resultUrl) setResultUrl(data.resultUrl);
      })
      .catch(() => toast.error("Не удалось загрузить настройки Robokassa"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        merchantLogin: values.merchantLogin,
        isTest: values.isTest,
      };
      if (values.password1 && values.password1 !== "••••••••") {
        body.password1 = values.password1;
      }
      if (values.password2 && values.password2 !== "••••••••") {
        body.password2 = values.password2;
      }
      const res = await fetch("/api/v1/admin/robokassa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      toast.success("Настройки Robokassa сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка настроек Robokassa...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Robokassa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Альтернатива ЮKassa: логин магазина и пароли из технических настроек в личном кабинете
          Robokassa. Активный провайдер выбирается блоком выше.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">Логин магазина</label>
          <p className="mt-0.5 text-xs text-muted-foreground">MerchantLogin в кабинете Robokassa</p>
          <Input
            type="text"
            value={values.merchantLogin}
            onChange={(e) => setValues((v) => ({ ...v, merchantLogin: e.target.value }))}
            className="mt-1 max-w-md"
            placeholder="demo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Пароль #1</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Для формирования ссылки на оплату. Хранится зашифрованно.
          </p>
          <div className="relative mt-1 max-w-md">
            <Input
              type={showPass1 ? "text" : "password"}
              value={values.password1}
              onChange={(e) => setValues((v) => ({ ...v, password1: e.target.value }))}
              placeholder="••••••••"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPass1((s) => !s)}
              aria-label={showPass1 ? "Скрыть" : "Показать"}
            >
              {showPass1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Пароль #2</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Для проверки уведомлений на Result URL (не путать с паролем #1).
          </p>
          <div className="relative mt-1 max-w-md">
            <Input
              type={showPass2 ? "text" : "password"}
              value={values.password2}
              onChange={(e) => setValues((v) => ({ ...v, password2: e.target.value }))}
              placeholder="••••••••"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPass2((s) => !s)}
              aria-label={showPass2 ? "Скрыть" : "Показать"}
            >
              {showPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.isTest}
            onChange={(e) => setValues((v) => ({ ...v, isTest: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm">Тестовый режим (IsTest=1)</span>
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Сохранение...
          </>
        ) : (
          "Сохранить Robokassa"
        )}
      </Button>

      <div className="rounded-xl border border-border bg-surface2 p-4">
        <h3 className="font-medium text-foreground">Result URL для кабинета Robokassa</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          В разделе технических настроек магазина укажите метод POST или GET и этот адрес для
          оповещения об оплате. Ответ сервера должен быть текстом{" "}
          <code className="rounded bg-background px-1">OK&#123;InvId&#125;</code> — это уже
          реализовано в приложении.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-[200px] break-all rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
            {resultUrl || "—"}
          </code>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              if (resultUrl) {
                void navigator.clipboard.writeText(resultUrl);
                toast.success("Result URL скопирован");
              }
            }}
          >
            Копировать
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          В кабинете должен быть выбран алгоритм подписи <strong>MD5</strong> (как в типовых
          примерах). Если включены пользовательские параметры Shp_* при оплате, их нужно учитывать
          в подписи — в текущей реализации они не передаются.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="https://docs.robokassa.ru/ru/pay-interface"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Документация Robokassa
          </Link>
        </p>
      </div>
    </div>
  );
}
