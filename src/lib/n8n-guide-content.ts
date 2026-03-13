import { configStore } from "./config-store";

export type N8nGuideContent = {
  title: string;
  subtitle: string;
  commonStepsHtml: string;
  comparisonHtml: string;
  httpTabHtml: string;
  pgvectorTabHtml: string;
};

const PREFIX = "n8n_guide.";
const CATEGORY = "n8n_guide";

const DEFAULT_TITLE = "Интеграция Qoqon RAG с n8n";
const DEFAULT_SUBTITLE =
  "Использование векторной базы Qoqon в качестве RAG-памяти для AI-агентов.";

const DEFAULT_COMMON_STEPS_HTML = `
<h2>1. Создание RAG-коллекции</h2>
<ol>
  <li>Раздел <strong>RAG-память</strong> → Создать</li>
  <li>Укажите название, выберите папку или файлы</li>
  <li>Нажмите <strong>Векторизовать</strong></li>
</ol>

<h2>2. API-ключ</h2>
<p>Раздел <a href="/dashboard/api-docs">API настройки</a> → создайте ключ. Формат: <code>qk_...__...</code></p>

<h2>3. ID коллекции</h2>
<pre><code>GET https://qoqon.ru/api/v1/rag/collections
Authorization: Bearer &lt;ключ&gt;</code></pre>
<p>Скопируйте <code>id</code> нужной коллекции.</p>
`.trim();

const DEFAULT_COMPARISON_HTML = `
<table>
  <thead>
    <tr><th>Параметр</th><th>HTTP Request</th><th>PGVector Store</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Эмбеддинги</strong></td><td>На стороне Qoqon</td><td>Генерируются в n8n</td></tr>
    <tr><td><strong>Согласование модели</strong></td><td>Не требуется</td><td>Обязательно та же, что в Qoqon</td></tr>
    <tr><td><strong>Тариф Qoqon</strong></td><td>RAG + токены на поиск</td><td>Только подключение к БД</td></tr>
    <tr><td><strong>Когда удобнее</strong></td><td>Один источник (Qoqon)</td><td>Агент с Vector Store в n8n</td></tr>
  </tbody>
</table>
`.trim();

const DEFAULT_HTTP_HTML = `
<h2>4. n8n — HTTP Request для поиска</h2>
<p>Используйте эндпоинт <code>files/search</code> — он возвращает <code>results[].chunkText</code> (релевантные фрагменты документов).</p>
<ul>
  <li><strong>Method:</strong> GET</li>
  <li><strong>URL:</strong> <code>https://qoqon.ru/api/v1/files/search</code></li>
  <li><strong>Query (обязательно):</strong> <code>q</code> — запрос, <code>collectionId</code> — ID коллекции</li>
  <li><strong>Query (опционально):</strong> <code>limit</code>, <code>threshold</code>. При <code>collectionId</code> поиск по именам файлов отключён — только семантический поиск по содержимому.</li>
  <li><strong>Auth:</strong> Header <code>Authorization: Bearer &lt;ключ&gt;</code></li>
</ul>
<pre><code>https://qoqon.ru/api/v1/files/search?q=ваш+запрос&amp;collectionId=&lt;id_коллекции&gt;&amp;limit=10</code></pre>

<h2>5. Схема агента</h2>
<p><strong>Trigger</strong> → <strong>HTTP Request</strong> (files/search) → <strong>Собрать чанки в контекст</strong> → <strong>LLM</strong> (промпт с контекстом) → <strong>Ответ</strong></p>
<p>В ответе Search API: <code>results[].chunkText</code> (результаты с type: "chunk") — передайте в системный промпт.</p>

<h2>6. Формат контекста для промпта</h2>
<pre><code>Контекст из базы знаний:
{{ $json.results.filter(r => r.type === 'chunk').map(r => r.chunkText).join('\\n\\n') }}

Вопрос пользователя: {{ $json.query }}</code></pre>
`.trim();

const DEFAULT_PGVECTOR_HTML = `
<h2>4. Postgres Credential в n8n</h2>
<p>Создайте credential типа <strong>Postgres</strong> (n8n 2.0):</p>
<ul>
  <li><strong>Host</strong> — из Qoqon (данные подключения)</li>
  <li><strong>Port</strong> — из Qoqon (например, 5433)</li>
  <li><strong>Database</strong> — как указано в Qoqon</li>
  <li><strong>User</strong> — <code>n8n_conn_xxx</code> (из Qoqon)</li>
  <li><strong>Password</strong> — пароль из Qoqon</li>
  <li><strong>SSL</strong> — включить, если требуется</li>
</ul>

<h2>5. Конфигурация ноды Postgres PGVector Store</h2>
<table>
  <thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
  <tbody>
    <tr><td><strong>Credential</strong></td><td>Postgres 2.0 (из шага 4)</td></tr>
    <tr><td><strong>Operation</strong></td><td>Retrieve Documents (As Tool for AI Agent)</td></tr>
    <tr><td><strong>Description</strong></td><td>Описание, что ищет инструмент</td></tr>
    <tr><td><strong>Table Name</strong></td><td><code>coll_xxx</code> — как в Qoqon</td></tr>
    <tr><td><strong>Limit</strong></td><td>4–10</td></tr>
    <tr><td><strong>Include Metadata</strong></td><td>включить</td></tr>
    <tr><td><strong>Use Collection</strong></td><td><strong>выключить</strong></td></tr>
  </tbody>
</table>
<p><strong>Важно:</strong> У Qoqon одна таблица на коллекцию, без отдельной таблицы коллекций. Поле <strong>Use Collection</strong> нужно <strong>выключить</strong>, а Collection Name и Collection Table Name не заполнять.</p>

<h2>6. Embeddings в n8n</h2>
<p>Модель эмбеддингов в n8n <strong>должна совпадать</strong> с моделью в Qoqon:</p>
<table>
  <thead><tr><th>В Qoqon</th><th>В n8n</th></tr></thead>
  <tbody>
    <tr><td>text-embedding-3-small</td><td>OpenAI Embeddings → text-embedding-3-small</td></tr>
    <tr><td>text-embedding-3-large</td><td>OpenAI Embeddings → text-embedding-3-large</td></tr>
    <tr><td>OpenRouter / openai/text-embedding-3-small</td><td>OpenRouter Embeddings или OpenAI Embeddings</td></tr>
  </tbody>
</table>
<p>Если модели разные, размерность векторов не совпадёт и поиск будет работать некорректно.</p>

<h2>7. Схема агента</h2>
<pre><code>[AI Agent]
   ├─ Chat Model → OpenRouter Chat Model (или другая LLM)
   └─ Tool → Postgres PGVector Store
                 └─ Embeddings → Embeddings OpenAI (та же модель, что в Qoqon)</code></pre>
`.trim();

export async function getN8nGuideContent(): Promise<N8nGuideContent> {
  const [title, subtitle, commonSteps, comparison, httpHtml, pgvectorHtml] =
    await Promise.all([
      configStore.get(`${PREFIX}title`),
      configStore.get(`${PREFIX}subtitle`),
      configStore.get(`${PREFIX}common_steps_html`),
      configStore.get(`${PREFIX}comparison_html`),
      configStore.get(`${PREFIX}http_tab_html`),
      configStore.get(`${PREFIX}pgvector_tab_html`),
    ]);

  return {
    title: title?.trim() || DEFAULT_TITLE,
    subtitle: subtitle?.trim() || DEFAULT_SUBTITLE,
    commonStepsHtml: commonSteps?.trim() || DEFAULT_COMMON_STEPS_HTML,
    comparisonHtml: comparison?.trim() || DEFAULT_COMPARISON_HTML,
    httpTabHtml: httpHtml?.trim() || DEFAULT_HTTP_HTML,
    pgvectorTabHtml: pgvectorHtml?.trim() || DEFAULT_PGVECTOR_HTML,
  };
}

export async function setN8nGuideContent(
  data: Partial<N8nGuideContent>,
): Promise<void> {
  const updates: Promise<void>[] = [];

  if (typeof data.title === "string") {
    updates.push(
      configStore.set(`${PREFIX}title`, data.title.trim(), {
        category: CATEGORY,
        description: "Заголовок страницы n8n-guide",
      }),
    );
  }
  if (typeof data.subtitle === "string") {
    updates.push(
      configStore.set(`${PREFIX}subtitle`, data.subtitle.trim(), {
        category: CATEGORY,
        description: "Подзаголовок страницы n8n-guide",
      }),
    );
  }
  if (typeof data.commonStepsHtml === "string") {
    updates.push(
      configStore.set(`${PREFIX}common_steps_html`, data.commonStepsHtml, {
        category: CATEGORY,
        description: "HTML общих шагов (подготовка)",
      }),
    );
  }
  if (typeof data.comparisonHtml === "string") {
    updates.push(
      configStore.set(`${PREFIX}comparison_html`, data.comparisonHtml, {
        category: CATEGORY,
        description: "HTML таблицы сравнения подходов",
      }),
    );
  }
  if (typeof data.httpTabHtml === "string") {
    updates.push(
      configStore.set(`${PREFIX}http_tab_html`, data.httpTabHtml, {
        category: CATEGORY,
        description: "HTML контент вкладки HTTP Request",
      }),
    );
  }
  if (typeof data.pgvectorTabHtml === "string") {
    updates.push(
      configStore.set(`${PREFIX}pgvector_tab_html`, data.pgvectorTabHtml, {
        category: CATEGORY,
        description: "HTML контент вкладки PGVector Store",
      }),
    );
  }

  await Promise.all(updates);

  [
    `${PREFIX}title`,
    `${PREFIX}subtitle`,
    `${PREFIX}common_steps_html`,
    `${PREFIX}comparison_html`,
    `${PREFIX}http_tab_html`,
    `${PREFIX}pgvector_tab_html`,
  ].forEach((k) => configStore.invalidate(k));
}
