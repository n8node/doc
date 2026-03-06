# Отчёт: проверка API эмбеддингов по внешнему ключу

**Дата:** 2026-03-06  
**Базовый URL:** https://qoqon.ru  
**Заголовок:** `Authorization: Bearer <API_KEY>`

---

## Обновление документации

Добавлена секция «Векторная база (эмбеддинги)» в API-документации (`/dashboard/api-docs`) с указанием:
- Работа эндпоинтов по API-ключу (Bearer)
- Описание методов: GET /embeddings, GET /{id}/embeddings, DELETE /{id}/embeddings

---

## Результаты тестирования

### 1. GET /api/v1/files/embeddings

**Статус:** 200 OK  
**Описание:** Список файлов с эмбеддингами

**Ответ (структура):**
```json
{
  "files": [
    {
      "id": "cmmega2zg0001o901utxq51hj",
      "name": "Документ (кодировка в выводе)",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 53758,
      "aiMetadata": { "numPages": 0, "processedAt": "2026-03-06T05:24:59.497Z", ... },
      "folder": null,
      "embeddingsCount": 185,
      "createdAt": "2026-03-06T05:24:52.252Z"
    }
  ]
}
```

**Фактически:** 12 файлов с эмбеддингами.

---

### 2. GET /api/v1/files/{id}/embeddings?page=1&limit=5

**Статус:** 200 OK  
**Описание:** Список чанков файла с пагинацией

**Параметры:** page=1, limit=5  
**File ID:** cmmega2zg0001o901utxq51hj

**Ответ (структура):**
```json
{
  "embeddings": [
    {
      "id": "cmmega2zg0001o901utxq51hj_chunk_0",
      "chunkIndex": 0,
      "chunkText": "Текст чанка...",
      "createdAt": "2026-03-06T05:25:00.652Z"
    }
  ],
  "total": 185,
  "totalPages": 37,
  "page": 1
}
```

**Фактически:** total=185, totalPages=37, 5 чанков на странице.

---

### 3. DELETE /api/v1/files/{id}/embeddings

Не проверялся, чтобы не удалять данные.  
Метод поддерживает тело `{ ids: string[] }` и использует тот же Bearer API-ключ.

---

## Вывод

- Оба GET-метода отвечают 200 OK и возвращают ожидаемую структуру.
- Авторизация по API-ключу работает.
- Пагинация в GET /{id}/embeddings работает (page, limit).

---

## Важно: безопасность API-ключа

API-ключ был использован только для теста. **Рекомендуется перевыпустить (rotate) ключ** в разделе «API настройки», так как он попадал в чат.
