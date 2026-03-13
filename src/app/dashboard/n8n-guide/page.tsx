"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, ChevronLeft, Globe, Database, Loader2 } from "lucide-react";

type TabId = "pgvector" | "http";

type Content = {
  title: string;
  subtitle: string;
  httpTabHtml: string;
  pgvectorTabHtml: string;
};

export default function N8nGuidePage() {
  const [tab, setTab] = useState<TabId>("pgvector");
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/n8n-guide-content")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setContent(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const codeClassName =
    "rounded bg-primary/15 px-1.5 py-0.5 text-primary font-medium";

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
          {content?.title || "Интеграция Qoqon RAG с n8n"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {content?.subtitle ||
            "Использование векторной базы Qoqon в качестве RAG-памяти для AI-агентов."}
        </p>
      </div>

      {/* Common steps */}
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold">1. Создание RAG-коллекции</h2>
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              Раздел <strong>RAG-память</strong> → Создать
            </li>
            <li>Укажите название, выберите папку или файлы</li>
            <li>
              Нажмите <strong>Векторизовать</strong>
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. API-ключ</h2>
          <p>
            Раздел{" "}
            <Link
              href="/dashboard/api-docs"
              className="text-primary hover:underline"
            >
              API настройки
            </Link>{" "}
            → создайте ключ. Формат:{" "}
            <code className={codeClassName}>qk_...__...</code>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. ID коллекции</h2>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground">
            {`GET https://qoqon.ru/api/v1/rag/collections
Authorization: Bearer <ключ>`}
          </pre>
          <p>
            Скопируйте <code className={codeClassName}>id</code> нужной
            коллекции.
          </p>
        </section>
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTab("pgvector")}
          className={`rounded-xl border-2 p-4 text-left transition-all ${
            tab === "pgvector"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className="flex items-center gap-2">
            <Database
              className={`h-5 w-5 ${tab === "pgvector" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className="font-semibold text-foreground">
              Postgres PGVector Store
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Прямое подключение к БД. Эмбеддинги генерируются в n8n. Агент
            автоматически обращается к базе как инструменту.
          </p>
          <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Рекомендуется
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("http")}
          className={`rounded-xl border-2 p-4 text-left transition-all ${
            tab === "http"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe
              className={`h-5 w-5 ${tab === "http" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className="font-semibold text-foreground">HTTP Request</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            REST API. Эмбеддинги на стороне Qoqon. Подходит когда нужен один
            источник без настройки моделей.
          </p>
        </button>
      </div>

      {/* Comparison table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                Параметр
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                HTTP Request
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                PGVector Store
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-4 py-2 font-medium text-foreground">
                Эмбеддинги
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                На стороне Qoqon
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                Генерируются в n8n
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium text-foreground">
                Согласование модели
              </td>
              <td className="px-4 py-2 text-muted-foreground">Не требуется</td>
              <td className="px-4 py-2 text-muted-foreground">
                Обязательно та же, что в Qoqon
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium text-foreground">
                Тариф Qoqon
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                RAG + токены на поиск
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                Только подключение к БД
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium text-foreground">
                Когда удобнее
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                Один источник (Qoqon)
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                Агент с Vector Store в n8n
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка...
        </div>
      ) : (
        <div
          className="
            prose prose-sm dark:prose-invert max-w-none
            [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border
            [&_thead]:bg-muted/50
            [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground
            [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-2
            [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-foreground
            [&_code]:rounded [&_code]:bg-primary/15 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-primary [&_code]:font-medium
            [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-foreground
          "
          dangerouslySetInnerHTML={{
            __html:
              tab === "http"
                ? content?.httpTabHtml || ""
                : content?.pgvectorTabHtml || "",
          }}
        />
      )}
    </div>
  );
}
