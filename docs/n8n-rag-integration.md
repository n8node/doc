# Интеграция Qoqon RAG с n8n

Использование векторной базы Qoqon в качестве RAG-памяти для AI-агентов в n8n и других платформах.

## Обзор

Qoqon предоставляет REST API для семантического поиска по документам. Есть **два способа** подключения:

1. **Postgres PGVector Store** (рекомендуется) — прямое подключение к БД, эмбеддинги генерируются в n8n
2. **HTTP Request** — REST API, эмбеддинги на стороне Qoqon

Для Chat Model (мозгов) агента можно использовать **Qoqon API Маркетплейс** как OpenAI-совместимый провайдер.

## Шаг 1: Создание RAG-коллекции

1. Войдите в [qoqon.ru](https://qoqon.ru)
2. Раздел **RAG-память** → **Создать**
3. Укажите название, выберите папку или файлы
4. Нажмите **Векторизовать**

## Шаг 2: API-ключ

1. Раздел **API настройки** → создайте API-ключ
2. Сохраните ключ (формат: `qk_...__...`) — он показывается один раз

## Шаг 3: Получение ID коллекции

```
GET https://qoqon.ru/api/v1/rag/collections
Authorization: Bearer <ваш_ключ>
```

В ответе найдите нужную коллекцию и скопируйте `id`.

> **Важно:** Эндпоинт `rag/collections` возвращает только список коллекций и файлов (метаданные). Он **не** выполняет семантический поиск. Для RAG-запросов используйте `files/search` (см. шаг 4).

## Qoqon API Маркетплейс (credential для Chat Model)

Qoqon Marketplace — OpenAI-совместимый прокси. Один ключ для Chat Model и Embeddings.

В n8n: **Settings → Credentials → Add Credential → OpenAI API**

| Поле | Значение |
|------|----------|
| **API Key** | `QoQon_LLM_xxx` (ключ маркетплейса из Qoqon) |
| **Base URL** | `https://qoqon.ru/api/v1/marketplace` |

### Доступные эндпоинты Marketplace

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/marketplace/chat/completions` | Chat Completions API |
| POST | `/api/v1/marketplace/responses` | Responses API (OpenAI SDK v4+) |
| POST | `/api/v1/marketplace/embeddings` | Embeddings API |
| GET | `/api/v1/marketplace/models` | Каталог моделей |

n8n автоматически подставляет нужный путь к Base URL.

---

## Способ 1: Postgres PGVector Store (рекомендуется)

### Шаг 4: Postgres Credential

Создайте credential типа **Postgres** (n8n 2.0) с данными из Qoqon (RAG-память → коллекция → n8n → Создать подключение).

### Шаг 5: Нода Postgres PGVector Store

| Параметр | Значение |
|----------|----------|
| **Credential** | Postgres 2.0 (из шага 4) |
| **Operation** | Retrieve Documents (As Tool for AI Agent) |
| **Table Name** | `coll_xxx` — из Qoqon |
| **Limit** | 4–10 |
| **Use Collection** | **выключить** |

### Шаг 6: Embeddings

Модель эмбеддингов в n8n должна совпадать с Qoqon (например, `text-embedding-3-small`).

### Схема агента (PGVector)

```
[AI Agent]
   ├─ Chat Model → OpenAI Chat Model (credential: Qoqon Marketplace)
   └─ Tool → Postgres PGVector Store
                 └─ Embeddings → Embeddings OpenAI (credential: Qoqon Marketplace, та же модель)
```

---

## Способ 2: HTTP Request

### Шаг 4: n8n — HTTP Request для RAG-поиска

Для семантического поиска по содержимому документов используйте **только** эндпоинт `files/search`. Он возвращает `results[].chunkText` — релевантные фрагменты для контекста LLM.

Добавьте ноду **HTTP Request**:

- **Method:** GET
- **URL:** `https://qoqon.ru/api/v1/files/search`
- **Query Parameters (обязательные):**
  - `q` = `{{ $json.query }}` (поисковый запрос пользователя)
  - `collectionId` = ID коллекции из шага 3 (например `cmmlts1ez006tpe0171dmoxqk`)
- **Query Parameters (опционально):**
  - `limit` = `10` (макс. результатов, по умолчанию 20)
  - `threshold` = `0.5` (порог схожести, ниже — больше результатов)
  - `searchByName` — при `collectionId` по умолчанию `false` (только чанки, не имена файлов)
- **Authentication:** Generic Credential Type
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer <ваш_ключ>`

**Пример полного URL:**  
`https://qoqon.ru/api/v1/files/search?q=какие+инверторы+у+тебя+есть&collectionId=cmmlts1ez006tpe0171dmoxqk&limit=10`

## Шаг 5: Использование в агенте

1. **Trigger** (Webhook / Form / Telegram и т.д.) — получает запрос пользователя
2. **HTTP Request** — поиск по Qoqon (см. выше)
3. **Code** или **Set** — собрать чанки из `results` в контекст
4. **OpenAI / другое LLM** — промпт с контекстом и вопросом
5. **Ответ** пользователю

### Пример формата контекста для промпта

Из ответа Search API:
```json
{
  "results": [
    {
      "type": "chunk",
      "chunkText": "...",
      "fileName": "...",
      "similarity": 0.89
    }
  ]
}
```

Соберите `chunkText` (результаты с `type: "chunk"`) и передайте в системный промпт:
```
Контекст из базы знаний:
{{ $json.results.filter(r => r.type === 'chunk').map(r => r.chunkText).join('\n\n') }}

Вопрос пользователя: {{ $json.query }}
```

## Команды

### Терминал (локально)
```bash
# Миграция БД (после обновления)
npx prisma migrate deploy
```

### Termius (сервер)
```bash
cd /path/to/qoqon
npx prisma migrate deploy
pm2 restart qoqon
```

## API-эндпоинты RAG

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/rag/collections` | Список коллекций |
| POST | `/api/v1/rag/collections` | Создать коллекцию |
| GET | `/api/v1/rag/collections/{id}` | Детали коллекции |
| PATCH | `/api/v1/rag/collections/{id}` | Обновить |
| DELETE | `/api/v1/rag/collections/{id}` | Удалить |
| POST | `/api/v1/rag/collections/{id}/validate` | Проверка файлов |
| POST | `/api/v1/rag/collections/{id}/vectorize` | Векторизация |
| GET | `/api/v1/files/search?q=...&collectionId=...` | Семантический поиск (RAG) — возвращает `results[].chunkText` |

## API-эндпоинты Marketplace (OpenAI-совместимые)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/marketplace/chat/completions` | Chat Completions (стандартный) |
| POST | `/api/v1/marketplace/responses` | Responses API (OpenAI SDK v4+, n8n 1.70+) |
| POST | `/api/v1/marketplace/embeddings` | Генерация эмбеддингов |
| GET | `/api/v1/marketplace/models` | Каталог доступных моделей |
