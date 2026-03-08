# Интеграция Qoqon RAG с n8n

Использование векторной базы Qoqon в качестве RAG-памяти для AI-агентов в n8n и других платформах.

## Обзор

Qoqon предоставляет REST API для семантического поиска по документам. Вы можете подключить RAG-коллекции (векторные «мозги») к агентам n8n через ноду **HTTP Request**.

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

## Шаг 4: n8n — HTTP Request для RAG-поиска

Добавьте ноду **HTTP Request**:

- **Method:** GET
- **URL:** `https://qoqon.ru/api/v1/files/search`
- **Query Parameters:**
  - `q` = `{{ $json.query }}` (или ваш ввод)
  - `collectionId` = `xxxxxxxx` (ID вашей RAG-коллекции)
  - `limit` = `10` (опционально)
  - `threshold` = `0.55` (опционально)
- **Authentication:** Generic Credential Type
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer <ваш_ключ>`

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

Соберите `chunkText` и передайте в системный промпт:
```
Контекст из базы знаний:
{{ $json.results.map(r => r.chunkText).join('\n\n') }}

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
| GET | `/api/v1/files/search?q=...&collectionId=...` | Поиск (RAG) |
