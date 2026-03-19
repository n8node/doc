"use client";

import { useState, useEffect } from "react";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Key, Copy, Trash2, FileText, Database, Folder, Share2, Archive, User, Zap, CreditCard, BrainCircuit, Bell, Store } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/user/api-info").then((r) => r.json()),
      fetch("/api/v1/user/api-keys").then((r) => r.json()),
    ])
      .then(([infoRes, keysRes]) => {
        if (infoRes.baseUrl) setBaseUrl(infoRes.baseUrl);
        if (Array.isArray(keysRes.keys)) setApiKeys(keysRes.keys);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newKeyName.trim() || "API Key";
    setCreatingKey(true);
    try {
      const res = await fetch("/api/v1/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const text = await res.text();
      let data: { error?: string; id?: string; name?: string; key?: string; keyPrefix?: string; createdAt?: string } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        if (!res.ok) throw new Error(`Ошибка сервера ${res.status}`);
      }
      if (!res.ok) throw new Error(data.error ?? `Ошибка создания ключа (${res.status})`);
      setApiKeys((prev) => [
        {
          id: data.id ?? "",
          name: data.name ?? "API Key",
          keyPrefix: data.keyPrefix ?? "qk_...",
          lastUsedAt: null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewKeyName("");
      setNewKeyValue(data.key ?? null);
      toast.success("API ключ создан. Сохраните его — он больше не будет показан.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка создания ключа");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    setDeletingKeyId(id);
    try {
      const res = await fetch(`/api/v1/user/api-keys/${id}`, { method: "DELETE" });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch { /* empty */ }
      if (!res.ok) throw new Error(data.error ?? `Ошибка удаления (${res.status})`);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Ключ удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления ключа");
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleCopyKey = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success("Скопировано");
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Документация API</h1>
        <p className="mt-1 text-muted-foreground">
          REST API для управления файлами, папками и общим доступом. Подходит для n8n, скриптов и других интеграций.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] items-start">
        {/* Левая колонка: API ключи */}
        <div className="rounded-2xl modal-glass overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API ключи
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Используйте API ключи для интеграции (n8n, скрипты и т.д.). Указывайте ключ в заголовке <code className="rounded bg-surface2 px-1">Authorization: Bearer &lt;key&gt;</code>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {baseUrl && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Базовый URL API</label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={baseUrl} className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => handleCopyKey(baseUrl)} title="Копировать">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Создать новый ключ</label>
              <form onSubmit={handleCreateApiKey} className="flex gap-2">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Например: n8n интеграция"
                  className="max-w-xs"
                />
                <Button type="submit" disabled={creatingKey}>
                  {creatingKey && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </Button>
              </form>
            </div>
            {newKeyValue && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  Сохраните ключ — он больше не будет показан
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-surface2 px-2 py-1 text-sm font-mono">{newKeyValue}</code>
                  <Button variant="outline" size="sm" onClick={() => handleCopyKey(newKeyValue)}>Копировать</Button>
                  <Button variant="ghost" size="sm" onClick={() => setNewKeyValue(null)}>Закрыть</Button>
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Ваши ключи</label>
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет активных ключей</p>
              ) : (
                <ul className="space-y-2">
                  {apiKeys.map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2/50 px-4 py-3">
                      <div>
                        <p className="font-medium">{k.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {k.keyPrefix}
                          {k.lastUsedAt ? ` · Использован ${new Date(k.lastUsedAt).toLocaleString("ru-RU")}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deletingKeyId === k.id}
                        onClick={() => handleDeleteApiKey(k.id)}
                      >
                        {deletingKeyId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Удалить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </div>

        {/* Правая колонка: документация */}
        <div className="space-y-6">
          <div className="rounded-2xl modal-glass overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Аутентификация
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Используйте API ключ в заголовке <code className="rounded bg-surface2 px-1">Authorization: Bearer &lt;ваш_ключ&gt;</code>.
                Создайте ключ в блоке слева.
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
                Операции сгруппированы по объектам. Эндпоинты с пометкой «только сессия» работают только через веб-интерфейс (cookie), не по API-ключу.
              </p>
            </CardHeader>
            <CardContent>
          <Accordion type="multiple" defaultValue={[]} className="space-y-1">
            <AccordionItem value="files" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Файлы (19 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
            <Section
              method="GET"
              path="/api/v1/files"
              desc="Список файлов. Ответ: files[].hasEmbedding, files[].aiMetadata"
              params={[
                { name: "folderId", type: "string", desc: "ID папки (опционально)" },
                { name: "scope", type: "all | \"\"", desc: "all — все подпапки" },
                { name: "type", type: "image | video | audio | document | all", desc: "Фильтр по типу" },
                { name: "sizeMin", type: "number", desc: "Мин. размер (байты)" },
                { name: "sizeMax", type: "number", desc: "Макс. размер (байты)" },
                { name: "dateFrom", type: "ISO date", desc: "Дата от" },
                { name: "dateTo", type: "ISO date", desc: "Дата до" },
                { name: "hasShareLink", type: "true", desc: "Только с публичными ссылками" },
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
              method="POST"
              path="/api/v1/files/upload"
              desc="Загрузка файла через FormData"
              body={{ file: "File", folderId: "string | null", duration: "number (опционально)" }}
            />
            <Section
              method="GET"
              path="/api/v1/files/search"
              desc="Семантический поиск по документам. RAG: возвращает results[].chunkText. Для n8n: ?q=запрос&collectionId=id"
              params={[
                { name: "q", type: "string", desc: "Поисковый запрос (обязательно)" },
                { name: "collectionId", type: "string", desc: "ID RAG-коллекции — поиск только по ней" },
                { name: "limit", type: "number", desc: "Макс. результатов (по умолчанию 20)" },
                { name: "threshold", type: "number", desc: "Порог схожести (по умолчанию 0.55)" },
                { name: "searchByName", type: "boolean", desc: "Включить поиск по имени файла (по умолчанию true)" },
              ]}
            />
            <Section
              method="GET"
              path="/api/v1/files/activity"
              desc="Статистика загрузок по дням за месяц"
              params={[
                { name: "month", type: "YYYY-MM", desc: "Месяц" },
                { name: "folderId", type: "string", desc: "ID папки (опционально)" },
                { name: "scope", type: "all | \"\"", desc: "all — все папки" },
              ]}
            />
            <Section
              method="GET"
              path="/api/v1/files/history"
              desc="История операций с файлами"
              params={[{ name: "limit", type: "number", desc: "Макс. событий (по умолчанию 200)" }]}
            />
            <Section
              method="POST"
              path="/api/v1/files/download-archive"
              desc="Скачать архив файлов (ZIP)"
              body={{ fileIds: "string[]" }}
            />
            <Section
              method="GET"
              path="/api/v1/files/{id}/chat"
              desc="История чата по документу"
            />
            <Section
              method="POST"
              path="/api/v1/files/{id}/chat"
              desc="Отправить сообщение в чат по документу"
              body={{ content: "string" }}
            />
            <Section
              method="GET"
              path="/api/v1/files/{id}/transcript"
              desc="Скачать транскрипт аудио (txt или docx)"
              params={[{ name: "format", type: "txt | docx", desc: "Формат выгрузки (по умолчанию txt)" }]}
            />
            <Section
              method="POST"
              path="/api/v1/files/{id}/embed-transcript"
              desc="Векторизация транскрипта аудио для чата и RAG. После транскрибации — индексация для поиска и чата"
            />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rag" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                  RAG-память (14 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    <strong>RAG-поиск:</strong> используйте <code className="rounded bg-surface2 px-1">GET /api/v1/files/search?q=...&collectionId=...</code> — возвращает <code className="rounded bg-surface2 px-1">results[].chunkText</code>. <strong>Синхронизация с папкой:</strong> <code className="rounded bg-surface2 px-1">GET /api/v1/files?folderId=...</code> → <code className="rounded bg-surface2 px-1">PATCH /api/v1/rag/collections/{`{id}`}</code> с <code className="rounded bg-surface2 px-1">fileIds</code> → <code className="rounded bg-surface2 px-1">POST vectorize</code> (обрабатывает только новые файлы).{" "}
                    <a href="/dashboard/n8n-guide" className="text-primary hover:underline">Гайд по интеграции</a>
                  </p>
                  <Section
                    method="GET"
                    path="/api/v1/rag/collections"
                    desc="Список RAG-коллекций (метаданные, ID). Для поиска — files/search"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/rag/collections"
                    desc="Создать коллекцию"
                    body={{ name: "string", folderId: "string (optional)", fileIds: "string[] (optional)" }}
                  />
                  <Section
                    method="GET"
                    path="/api/v1/rag/collections/{id}"
                    desc="Коллекция по ID"
                  />
                  <Section
                    method="PATCH"
                    path="/api/v1/rag/collections/{id}"
                    desc="Обновить коллекцию. fileIds — полная замена состава (для синхронизации с папкой)"
                    body={{ name: "string (optional)", folderId: "string | null (optional)", fileIds: "string[] (optional)", embeddingConfig: "object (optional)" }}
                  />
                  <Section
                    method="DELETE"
                    path="/api/v1/rag/collections/{id}"
                    desc="Удалить коллекцию"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/rag/collections/{id}/validate"
                    desc="Проверка: какие файлы можно векторизовать. Аудио с транскриптом — пригодны"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/rag/collections/{id}/vectorize"
                    desc="Массовая векторизация. Уже векторизованные файлы пропускаются, обрабатываются только новые. Body: { skipFirst?: number }"
                    body={{ skipFirst: "number (optional)" }}
                  />
                  <Section
                    method="GET"
                    path="/api/v1/rag/collections/{id}/vectorize/status"
                    desc="Статус векторизации (polling после POST vectorize)"
                    params={[{ name: "taskId", type: "string", desc: "ID задачи (опционально — последняя активная)" }]}
                  />
                  <Section
                    method="GET"
                    path="/api/v1/rag/collections/{id}/n8n-connections"
                    desc="Список PGVector-подключений коллекции (для n8n)"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/rag/collections/{id}/n8n-connections"
                    desc="Создать PGVector-подключение (host, port, user, password, viewName для n8n)"
                    body={{ target: '"DEFAULT" | "RF" (optional)' }}
                  />
                  <Section
                    method="DELETE"
                    path="/api/v1/rag/collections/{id}/n8n-connections/{connId}"
                    desc="Удалить PGVector-подключение"
                  />
                  <Section
                    method="GET"
                    path="/api/v1/rag/collections/{id}/export"
                    desc="Экспорт векторов коллекции (SQL, Supabase, Qdrant)"
                    params={[{ name: "format", type: "sql | supabase | qdrant", desc: "Формат выгрузки" }]}
                  />
                  <Section
                    method="DELETE"
                    path="/api/v1/rag/collections/{id}/embeddings"
                    desc="Удалить эмбеддинги всех файлов коллекции"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="embeddings" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Векторная база (эмбеддинги) (3 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    По API ключу: <code className="rounded bg-surface2 px-1">Authorization: Bearer &lt;ключ&gt;</code>
                  </p>
                  <Section
                    method="GET"
                    path="/api/v1/files/embeddings"
                    desc="Список файлов с эмбеддингами (обработанных AI)"
                  />
                  <Section
                    method="GET"
                    path="/api/v1/files/{id}/embeddings"
                    desc="Список чанков файла с пагинацией"
                    params={[
                      { name: "page", type: "number", desc: "Страница (по умолчанию 1)" },
                      { name: "limit", type: "number", desc: "Строк на странице (10–100, по умолчанию 20)" },
                    ]}
                  />
                  <Section
                    method="DELETE"
                    path="/api/v1/files/{id}/embeddings"
                    desc="Удалить чанки по ID. Body: { ids: string[] }"
                    body={{ ids: "string[]" }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="marketplace" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  API Маркетплейс (4 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    OpenAI-совместимый прокси (Chat, Embeddings). Base URL: <code className="rounded bg-surface2 px-1">/api/v1/marketplace</code>.{" "}
                    <a href="/dashboard/n8n-guide" className="text-primary hover:underline">Гайд по интеграции с n8n</a>
                  </p>
                  <Section
                    method="GET"
                    path="/api/v1/marketplace/models"
                    desc="Каталог моделей (формат OpenAI: object: list, data: [{ id, object, created, owned_by }])"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/marketplace/chat/completions"
                    desc="Chat Completions API"
                    body={{ messages: "Message[]", model: "string", stream: "boolean (optional)" }}
                  />
                  <Section
                    method="POST"
                    path="/api/v1/marketplace/responses"
                    desc="Responses API (OpenAI SDK v4+, n8n 1.70+)"
                    body={{ messages: "Message[]", model: "string", stream: "boolean (optional)" }}
                  />
                  <Section
                    method="POST"
                    path="/api/v1/marketplace/embeddings"
                    desc="Генерация эмбеддингов"
                    body={{ input: "string | string[]", model: "string" }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="process" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Обработка и транскрипция (7 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <Section
                    method="GET"
                    path="/api/v1/files/process"
                    desc="Статус обработки документа"
                    params={[{ name: "fileId", type: "string", desc: "ID файла" }]}
                  />
                  <Section
                    method="POST"
                    path="/api/v1/files/process"
                    desc="Запуск обработки (извлечение текста, эмбеддинги)"
                    body={{ fileId: "string", fileIds: "string[]" }}
                  />
                  <Section
                    method="POST"
                    path="/api/v1/files/transcribe"
                    desc="Запуск транскрипции аудио"
                    body={{ fileId: "string" }}
                  />
                  <Section
                    method="GET"
                    path="/api/v1/files/transcribe"
                    desc="Статус транскрипции"
                    params={[{ name: "fileId", type: "string", desc: "ID файла" }]}
                  />
                  <Section
                    method="GET"
                    path="/api/v1/files/transcribe/estimate"
                    desc="Оценка времени транскрипции"
                    params={[{ name: "fileId", type: "string", desc: "ID файла" }]}
                  />
                  <Section
                    method="POST"
                    path="/api/v1/files/{id}/embed-transcript"
                    desc="Векторизация транскрипта аудио (после транскрибации) — для чата и RAG"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="folders" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  Папки (7 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
            <Section
              method="GET"
              path="/api/v1/folders"
              desc="Список папок"
              params={[
                { name: "parentId", type: "string", desc: "ID родительской папки" },
                { name: "scope", type: "all | \"\"", desc: "all — все папки рекурсивно" },
                { name: "hasShareLink", type: "true", desc: "Только папки с публичными ссылками" },
              ]}
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
              path="/api/v1/folders/{id}/path"
              desc="Путь до папки (хлебные крошки)"
            />
            <Section
              method="POST"
              path="/api/v1/folders/bulk"
              desc="Массовые операции с папками"
              body={{ ids: "string[]", action: "delete | move | copy", parentId: "string | null" }}
            />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="share" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  Общий доступ (3 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
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
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notifications" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Уведомления (4 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <Section
                    method="GET"
                    path="/api/v1/notifications"
                    desc="Список уведомлений"
                    params={[
                      { name: "limit", type: "number", desc: "Макс. записей (1–200, по умолчанию 50)" },
                      { name: "offset", type: "number", desc: "Смещение" },
                      { name: "type", type: "STORAGE | TRASH | PAYMENT | AI_TASK | QUOTA | SHARE_LINK", desc: "Фильтр по типу" },
                      { name: "unreadOnly", type: "true", desc: "Только непрочитанные" },
                    ]}
                  />
                  <Section
                    method="DELETE"
                    path="/api/v1/notifications"
                    desc="Удалить все уведомления"
                  />
                  <Section
                    method="PATCH"
                    path="/api/v1/notifications/{id}/read"
                    desc="Отметить уведомление прочитанным"
                  />
                  <Section
                    method="POST"
                    path="/api/v1/notifications/read-all"
                    desc="Отметить все уведомления прочитанными"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trash" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Корзина (4 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
            <Section method="GET" path="/api/v1/trash" desc="Содержимое корзины" />
            <Section
              method="POST"
              path="/api/v1/trash/restore"
              desc="Восстановить из корзины"
              body={{ fileIds: "string[]", folderIds: "string[]" }}
            />
            <Section
              method="DELETE"
              path="/api/v1/trash/{id}"
              desc="Удалить файл или папку из корзины"
              params={[{ name: "type", type: "file | folder", desc: "Тип элемента" }]}
            />
            <Section
              method="POST"
              path="/api/v1/trash/empty"
              desc="Очистить корзину полностью"
            />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="user" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Пользователь (13 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
            <Section method="GET" path="/api/v1/user/me" desc="Текущий пользователь" />
            <Section method="GET" path="/api/v1/user/storage" desc="Использование хранилища" />
            <Section method="GET" path="/api/v1/user/api-info" desc="Базовый URL API" />
            <Section method="GET" path="/api/v1/user/preferences" desc="Настройки пользователя (theme, emailNotifications)" />
            <Section
              method="PATCH"
              path="/api/v1/user/preferences"
              desc="Изменить настройки"
              body={{ theme: "light | dark | system", emailNotifications: "boolean" }}
            />
            <Section
              method="PATCH"
              path="/api/v1/user/profile"
              desc="Обновить имя"
              body={{ name: "string | null" }}
            />
            <Section
              method="POST"
              path="/api/v1/user/password"
              desc="Смена пароля (только сессия)"
              body={{ currentPassword: "string", newPassword: "string" }}
            />
            <Section method="GET" path="/api/v1/user/payments" desc="История платежей" />
            <Section
              method="DELETE"
              path="/api/v1/user/account"
              desc="Удалить аккаунт (только сессия)"
              body={{ password: "string" }}
            />
            <Section method="GET" path="/api/v1/user/document-chats" desc="Файлы с чатами по документам" />
            <Section method="GET" path="/api/v1/user/ai-config" desc="AI-конфигурация (провайдеры, модели)" />
            <Section
              method="PUT"
              path="/api/v1/user/ai-config"
              desc="Обновить AI-конфигурацию"
              body={{ providers: "array", defaultProviderId: "string | null" }}
            />
            <Section
              method="POST"
              path="/api/v1/user/ai-config/test"
              desc="Тест подключения к AI-провайдеру"
              body={{ providerId: "string" }}
            />
            <Section method="POST" path="/api/v1/user/link-email" desc="Привязать email" />
            <Section method="POST" path="/api/v1/user/link-telegram" desc="Привязать Telegram" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="plans" className="rounded-xl border border-border px-4 data-[state=open]:bg-surface2/30">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Тарифы (3 методов)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
            <Section method="GET" path="/api/v1/plans" desc="Список тарифов (публичный)" />
            <Section method="GET" path="/api/v1/plans/me" desc="Текущий тариф пользователя" />
            <Section
              method="POST"
              path="/api/v1/plans/subscribe"
              desc="Подписка на тариф (только сессия)"
              body={{ planId: "string", period: "monthly | yearly" }}
            />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
          </div>
        </div>
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
    method === "PATCH" || method === "PUT" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
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
