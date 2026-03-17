# Kie.ai: стоимость генерации по прайсу

## Подход

Стоимость генерации в кредитах **не** берётся из callback/recordInfo Kie (в ответах нет поля «кредиты за задачу»; поле `costTime` — это время обработки в миллисекундах).

Мы храним актуальные цены в таблице **`kie_pricing`** (модель + вариант → кредиты, USD). Источник — страница [https://kie.ai/pricing](https://kie.ai/pricing).

1. **Раз в сутки** (или по кнопке в админке) выполняется синхронизация: запрос kie.ai/pricing, парсинг, обновление `kie_pricing`. Если парсинг не удаётся, подставляются значения по умолчанию.
2. При **успешном завершении задачи** (webhook или polling) стоимость берётся из `kie_pricing` по `modelId` и `variant` задачи, записывается в `ImageGenerationTask.costCredits`, наценка применяется при отдаче в API (billedCredits).

## Таблица kie_pricing

- `model_id` — наш идентификатор модели (например `kie-4o-image`, `kie-flux-kontext`).
- `variant` — вариант (например `flux-kontext-pro`, `flux-kontext-max`) или `null`.
- `price_credits`, `price_usd`, `fetched_at`.

Уникальность: `(model_id, variant)`.

## API

- `GET /api/v1/admin/generation/pricing` — список записей прайса (админ).
- `POST /api/v1/admin/generation/pricing/sync` — запуск синхронизации с kie.ai/pricing (админ).

## Расписание

Рекомендуется вызывать sync раз в сутки (cron на сервере или внешний планировщик), например в 03:00 UTC.

## Ссылки

- [Kie.ai Pricing](https://kie.ai/pricing) — страница с актуальными ценами.
- [Get Task Details](https://docs.kie.ai/market/common/get-task-detail) — `costTime` = время обработки в мс, не кредиты.
