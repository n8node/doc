"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const S3_DEFAULTS = {
  endpoint: "https://s3.ru1.storage.beget.cloud",
  bucket: "5a4cc9f7950f-doc",
  region: "ru-central1",
  accessKeyId: "JV7OZXU5VTWF0REKA2N5",
  secretAccessKey: "e4IbSh1a8ZBS4FjYrX2ipXCHFBoBmi8EE6PDLaVm",
};

export function S3SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [values, setValues] = useState(S3_DEFAULTS);

  useEffect(() => {
    fetch("/api/admin/s3")
      .then((r) => r.json())
      .then((data) => {
        if (data.endpoint) setValues((v) => ({ ...v, ...data }));
      })
      .catch(() => toast.error("Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/s3/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message ?? "Подключение успешно");
      } else {
        toast.error(data.message ?? "Ошибка подключения");
      }
    } catch {
      toast.error("Ошибка запроса");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        S3-совместимое хранилище
      </h2>
      <p className="text-sm text-muted-foreground">
        Beget, Yandex Cloud, SberCloud, Selectel
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Endpoint (URL)
          </label>
          <Input
            type="url"
            value={values.endpoint}
            onChange={(e) =>
              setValues((v) => ({ ...v, endpoint: e.target.value }))
            }
            placeholder={S3_DEFAULTS.endpoint}
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Bucket (имя бакета)
          </label>
          <Input
            type="text"
            value={values.bucket}
            onChange={(e) =>
              setValues((v) => ({ ...v, bucket: e.target.value }))
            }
            placeholder={S3_DEFAULTS.bucket}
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Region
          </label>
          <Input
            type="text"
            value={values.region}
            onChange={(e) =>
              setValues((v) => ({ ...v, region: e.target.value }))
            }
            placeholder={S3_DEFAULTS.region}
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Access Key ID
          </label>
          <Input
            type="text"
            value={values.accessKeyId}
            onChange={(e) =>
              setValues((v) => ({ ...v, accessKeyId: e.target.value }))
            }
            placeholder="Access key"
            className="mt-1 max-w-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Secret Access Key
          </label>
          <Input
            type="password"
            value={values.secretAccessKey}
            onChange={(e) =>
              setValues((v) => ({ ...v, secretAccessKey: e.target.value }))
            }
            placeholder="Secret key"
            className="mt-1 max-w-md"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Проверка...
            </>
          ) : (
            "Проверка соединения"
          )}
        </Button>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface2 p-4">
        <h3 className="font-medium text-foreground">
          Настройки CORS для бакета S3
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Чтобы загрузка и работа с файлами работала с домена qoqon.ru, добавьте
          в настройках CORS бакета следующую конфигурацию:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs text-foreground">
{`<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://qoqon.ru</AllowedOrigin>
    <AllowedOrigin>https://www.qoqon.ru</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>http://localhost:3001</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>`}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">
          В панели Beget: Cloud → Object Storage → выбрать бакет → CORS.
        </p>
      </div>
    </div>
  );
}
