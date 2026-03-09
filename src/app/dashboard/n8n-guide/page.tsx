"use client";

import Link from "next/link";
import { BrainCircuit, ChevronLeft } from "lucide-react";

export default function N8nGuidePage() {
  const codeClassName =
    "rounded bg-primary px-1.5 py-0.5 text-primary-foreground";

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/api-docs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        API настройки
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BrainCircuit className="h-7 w-7 text-primary" />
          Интеграция Qoqon RAG с n8n
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Использование векторной базы Qoqon в качестве RAG-памяти для AI-агентов.
        </p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold">1. Создание RAG-коллекции</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Раздел <strong>RAG-память</strong> → Создать</li>
            <li>Укажите название, выберите папку или файлы</li>
            <li>Нажмите <strong>Векторизовать</strong></li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. API-ключ</h2>
          <p>
            Раздел{" "}
            <Link href="/dashboard/api-docs" className="text-primary hover:underline">
              API настройки
            </Link>{" "}
            → создайте ключ. Формат:{" "}
            <code className={codeClassName}>qk_...__...</code>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. ID коллекции</h2>
          <pre className="overflow-x-auto rounded-lg bg-primary p-4 text-sm text-primary-foreground">
{`GET https://qoqon.ru/api/v1/rag/collections
Authorization: Bearer <ключ>`}
          </pre>
          <p>
            Скопируйте <code className={codeClassName}>id</code> нужной коллекции.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. n8n — HTTP Request</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Method:</strong> GET</li>
            <li>
              <strong>URL:</strong>{" "}
              <code className={codeClassName}>https://qoqon.ru/api/v1/files/search</code>
            </li>
            <li>
              <strong>Query:</strong> <code className={codeClassName}>q</code>,{" "}
              <code className={codeClassName}>collectionId</code>,{" "}
              <code className={codeClassName}>limit</code>,{" "}
              <code className={codeClassName}>threshold</code>
            </li>
            <li>
              <strong>Auth:</strong> Header{" "}
              <code className={codeClassName}>Authorization: Bearer &lt;ключ&gt;</code>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Схема в агенте</h2>
          <p>Trigger → HTTP Request (поиск) → Собрать чанки в контекст → LLM (промпт с контекстом) → Ответ</p>
          <p className="mt-2 text-sm text-muted-foreground">
            В ответе Search API: <code className={codeClassName}>results[].chunkText</code> — используйте для промпта.
          </p>
        </section>
      </div>
    </div>
  );
}
