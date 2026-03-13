# Деплой: Финансовая система Qoqon

## Миграция БД

На сервере (Termius) после `git pull` выполните миграцию:

```bash
docker exec -i dropbox-ru-db-1 psql -U postgres -d dropbox_ru < /opt/dropbox-ru/prisma/migrations/20260313000000_add_finance_models/migration.sql
```

Либо через Prisma (если установлен на сервере):

```bash
cd /opt/dropbox-ru && npx prisma migrate deploy
```

## Пересборка и запуск

```bash
docker compose build app && docker compose up -d
```

## Новые таблицы

- `open_router_topup_batches` — партии пополнения OpenRouter (USD, RUB, курс)
- `platform_expenses` — операционные расходы (сервер, S3 и т.д.)

## Настройки (AdminConfig)

Финансовые настройки хранятся в `admin_config` по ключам:

- `finance.tax_rate_pct` — налог ИП %
- `finance.payment_commission_pct` — комиссия эквайринга %
- `finance.payment_commission_payer` — platform | user
- `finance.fx_buffer_pct` — валютный буфер %
- `finance.s3_cost_per_gb_day_cents` — себестоимость S3 коп/ГБ/день
- `finance.s3_markup_pct` — наценка S3 %
- `finance.default_token_markup_pct` — наценка на токены %

При первом заходе в админку используются значения по умолчанию (7%, 2.5%, platform, 5%, 7, 30%, 30%).
