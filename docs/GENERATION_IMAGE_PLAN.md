# План: раздел «Генерация изображений» (Kie.ai)

## Требования
- Задача → модели → настройки → промпт/фото → результат (картинка + стоимость в кредитах).
- Наценка на токены/кредиты при генерации — настраивается **отдельно** от маркетплейса LLM.
- После получения результата картинка **автоматически сохраняется** на диск пользователя (в его хранилище).

## Реализовано
- См. [GENERATION_IMAGE_VERIFICATION.md](./GENERATION_IMAGE_VERIFICATION.md) — что сделано и как проверить.

## Шаги реализации (выполнены)

1. **Миграция БД + конфиг**
   - Таблица `image_generation_tasks` (userId, kieTaskId, modelId, taskType, status, costCredits, resultUrl, fileId, createdAt).
   - Ключи AdminConfig: `kie.api_key`, `generation.image_enabled`, `generation.image_tasks`, `generation.image_models`, `generation.margin_percent`.

2. **Бэкенд: конфиг и наценка**
   - Чтение/запись конфига генерации, отдельная наценка `generation.margin_percent` (как marketplace.margin_percent).

3. **Бэкенд: Kie API + сохранение на диск**
   - Клиент Kie: создание задачи (4o / Flux), получение результата по taskId или callback.
   - Функция: скачать изображение по URL → загрузить в S3 → создать запись File (createFileRecordFromS3Object), обновить task.fileId.

4. **API роуты**
   - `POST /api/v1/generate/image` — создание задачи, возврат taskId.
   - `GET /api/v1/generate/image/status?taskId=` — статус, resultUrl, costCredits, fileId.
   - `POST /api/v1/webhooks/kie-image` — callback от Kie, сохранение файла на диск.
   - `GET /api/v1/generate/image/tasks` и `GET /api/v1/generate/image/models?taskId=` — для UI.
   - Админ: `GET/PUT /api/v1/admin/generation/config`, `GET/POST /api/v1/admin/kie/api-key`, `GET /api/v1/admin/kie/status`.

5. **Админка**
   - Страница «Генерация» (или «Kie.ai»): API-ключ, вкл/выкл раздела, наценка %, задачи, модели.
   - В форме тарифа — фича `content_generation` («Генерация изображений»).

6. **Фронт раздела генерации**
   - Страница `/dashboard/generate/image`: выбор задачи → выбор модели → форма (промпт, загрузка фото, настройки) → отправка → опрос статуса → результат (картинка, стоимость, ссылка на файл на диске).

7. **Отчёт и проверка**
   - Краткий отчёт что сделано, как проверить (админка, генерация, автосохранение).
