"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Loader2, Key, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/user/api-info")
      .then((r) => r.json())
      .then((d) => {
        if (d.baseUrl) setBaseUrl(d.baseUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Документация API</h1>
        <p className="mt-1 text-muted-foreground">
          REST API для управления файлами, папками и общим доступом. Подходит для n8n, скриптов и других интеграций.
        </p>
      </div>

      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Аутентификация
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Используйте API ключ в заголовке <code className="rounded bg-surface2 px-1">Authorization: Bearer &lt;ваш_ключ&gt;</code>.
            Ключи создаются в <Link href="/dashboard/settings" className="text-primary underline">настройках</Link>.
          </p>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-surface2 p-4 text-sm">
{`curl -X GET "${baseUrl || "https://example.com"}/files" \\
  -H "Authorization: Bearer qk_xxxxxxxx__yyyyyyyy"`}
          </pre>
        </CardContent>
      </div>

      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Базовый URL</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </span>
            ) : baseUrl ? (
              <code className="rounded bg-surface2 px-1">{baseUrl}</code>
            ) : (
              "Войдите, чтобы увидеть URL"
            )}
          </p>
        </CardHeader>
      </div>

      <div className="rounded-2xl modal-glass overflow-hidden">
        <CardHeader>
          <CardTitle>Эндпоинты</CardTitle>
          <p className="text-sm text-muted-foreground">
            Основные операции с файлами и папками
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Section
              method="GET"
              path="/api/v1/files"
              desc="Список файлов"
              params={[
                { name: "folderId", type: "string", desc: "ID папки (опционально)" },
                { name: "scope", type: "all | \"\"", desc: "all — все подпапки" },
                { name: "type", type: "image | video | audio | document | all", desc: "Фильтр по типу" },
              ]}
            />
            <Section
              method="GET"
              path="/api/v1/files/{id}"
              desc="Информация о файле"
            />
            <Section
              method="PATCH"
              path="/api/v1/files/{id}"
              desc="Переименовать или переместить файл"
              body={{ name: "string", folderId: "string | null" }}
            />
            <Section
              method="DELETE"
              path="/api/v1/files/{id}"
              desc="Удалить файл (в корзину или окончательно)"
              params={[{ name: "permanent", type: "true", desc: "Окончательное удаление" }]}
            />
            <Section
              method="GET"
              path="/api/v1/files/{id}/download"
              desc="Скачать файл (редирект)"
            />
            <Section
              method="GET"
              path="/api/v1/files/{id}/stream"
              desc="Потоковая передача файла (поддержка Range)"
            />
            <Section
              method="POST"
              path="/api/v1/files/upload/init"
              desc="Инициировать загрузку (presigned URL)"
              body={{
                name: "string",
                size: "number",
                mimeType: "string",
                folderId: "string | null",
              }}
            />
            <Section
              method="POST"
              path="/api/v1/files/upload/complete"
              desc="Завершить загрузку после PUT в presigned URL"
              body={{ uploadSessionToken: "string" }}
            />
            <Section
              method="POST"
              path="/api/v1/files/bulk"
              desc="Массовые операции"
              body={{ ids: "string[]", action: "delete | move | copy", folderId: "string | null" }}
            />
            <Section
              method="GET"
              path="/api/v1/folders"
              desc="Список папок"
              params={[{ name: "parentId", type: "string", desc: "ID родительской папки" }]}
            />
            <Section
              method="POST"
              path="/api/v1/folders"
              desc="Создать папку"
              body={{ name: "string", parentId: "string | null" }}
            />
            <Section
              method="GET"
              path="/api/v1/folders/{id}"
              desc="Информация о папке"
            />
            <Section
              method="PATCH"
              path="/api/v1/folders/{id}"
              desc="Переименовать или переместить папку"
              body={{ name: "string", parentId: "string | null" }}
            />
            <Section
              method="DELETE"
              path="/api/v1/folders/{id}"
              desc="Удалить папку"
            />
            <Section
              method="GET"
              path="/api/v1/share"
              desc="Список ссылок доступа"
              params={[
                { name: "fileId", type: "string", desc: "Фильтр по файлу" },
                { name: "folderId", type: "string", desc: "Фильтр по папке" },
              ]}
            />
            <Section
              method="POST"
              path="/api/v1/share"
              desc="Создать ссылку доступа"
              body={{
                targetType: "FILE | FOLDER",
                fileId: "string (если FILE)",
                folderId: "string (если FOLDER)",
                expiresAt: "ISO date | null",
                oneTime: "boolean",
              }}
            />
            <Section method="DELETE" path="/api/v1/share/{id}" desc="Отозвать ссылку" />
            <Section method="GET" path="/api/v1/trash" desc="Содержимое корзины" />
            <Section
              method="POST"
              path="/api/v1/trash/restore"
              desc="Восстановить из корзины"
              body={{ fileIds: "string[]", folderIds: "string[]" }}
            />
            <Section method="GET" path="/api/v1/user/me" desc="Текущий пользователь" />
            <Section method="GET" path="/api/v1/user/storage" desc="Использование хранилища" />
          </div>
        </CardContent>
      </div>

      <div className="flex items-center justify-between rounded-2xl modal-glass p-6">
        <p className="text-sm text-muted-foreground">
          Создавайте и удаляйте API ключи в настройках
        </p>
        <Link href="/dashboard/settings" className={cn(buttonVariants(), "gap-2")}>
          Настройки
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Section({
  method,
  path,
  desc,
  params = [],
  body,
}: {
  method: string;
  path: string;
  desc: string;
  params?: { name: string; type: string; desc: string }[];
  body?: Record<string, string>;
}) {
  const methodColor =
    method === "GET" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
    method === "POST" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
    method === "PATCH" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
    method === "DELETE" ? "bg-red-500/20 text-red-600 dark:text-red-400" :
    "";

  return (
    <div className="border-b border-border/70 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded px-2 py-0.5 text-xs font-mono font-semibold", methodColor)}>
          {method}
        </span>
        <code className="font-mono text-sm text-foreground">{path}</code>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      {params.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Параметры: {params.map((p) => `${p.name} (${p.type}) — ${p.desc}`).join("; ")}
        </p>
      )}
      {body && Object.keys(body).length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Body: {JSON.stringify(body)}
        </p>
      )}
    </div>
  );
}
