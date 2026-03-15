# Отчёт: фича «Таблицы» (Sheets)

## Что сделано

### Шаг 1 — Модель данных и миграция
- **Prisma**: модели `Sheet`, `SheetColumn`, `SheetCell` (таблица пользователя, колонки с типом/конфигом, ячейки по `sheetId` + `columnId` + `rowIndex`).
- **Миграция**: `prisma/migrations/20260315120000_add_sheets/migration.sql` — создание таблиц `sheets`, `sheet_columns`, `sheet_cells` с индексами и внешними ключами.

### Шаг 2 — API
- **GET/POST** `/api/v1/sheets` — список таблиц пользователя, создание таблицы (опционально с колонками).
- **GET/PATCH/DELETE** `/api/v1/sheets/:id` — одна таблица с колонками и строками ячеек, переименование, удаление.
- **GET/POST** `/api/v1/sheets/:id/columns` — список колонок, добавление колонки.
- **PATCH/DELETE** `/api/v1/sheets/:id/columns/:columnId` — изменение/удаление колонки.
- **GET/PATCH/DELETE** `/api/v1/sheets/:id/cells` — чтение ячеек (с опцией range), массовое обновление (`updates` или `fill`), очистка диапазона.
- **GET** `/api/v1/sheets/:id/export?format=json` — экспорт таблицы в JSON (скачивание).

Все маршруты требуют авторизации (session).

### Шаг 3 — Дашборд: список и создание
- В сайдбаре (Интеграции) добавлен пункт **«Таблицы»** → `/dashboard/sheets`.
- Страница списка таблиц: карточки с названием, числом колонок и ячеек, кнопки «Создать» и удаление. После создания — переход в редактор таблицы.

### Шаг 4 — Редактор таблицы (TanStack Table)
- Страница `/dashboard/sheets/:id`: заголовок с названием (двойной клик — переименование), кнопки «Колонка», «Строка», «JSON» (экспорт).
- Таблица на **@tanstack/react-table**: колонки из `sheet.columns`, строки из `sheet.rows`; ячейки — инпуты, сохранение по **blur** через `PATCH /api/v1/sheets/:id/cells` с одним `updates: [{ rowIndex, columnId, value }]`.
- Добавление строки/колонки через соответствующие API с последующей перезагрузкой данных.

---

## Команды для деплоя на сервер (Termius SSH)

Выполнять по порядку.

### 1. Синхронизация репозитория
```bash
cd /opt/dropbox-ru && git pull origin main
```

### 2. Миграция БД (новая миграция для таблиц)
```bash
docker exec -i dropbox-ru-db-1 psql -U postgres -d dropbox_ru < /opt/dropbox-ru/prisma/migrations/20260315120000_add_sheets/migration.sql
```

### 3. Сборка и перезапуск
```bash
docker compose build app && docker compose up -d
```

Если меняли только фронт/бэкенд (не docling):
```bash
docker compose build app && docker compose up -d
```

---

## Проверка после деплоя

1. Залогиниться в приложение.
2. Открыть **Интеграции → Таблицы**.
3. Создать таблицу, открыть её, добавить колонку и строку, ввести значение в ячейку и уйти с поля (blur) — значение должно сохраниться.
4. Нажать «JSON» — должен скачаться файл с экспортом таблицы.

---

## Зависимости

- В `package.json` добавлен `@tanstack/react-table: ^8.20.5`. На сервере при `docker compose build app` зависимости ставятся из `package-lock.json`.
