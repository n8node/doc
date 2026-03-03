# qoqon.ru — Dropbox-подобный сервис с AI-поиском

Облачное хранилище для рынка РФ с интеграцией искусственного интеллекта (анализ, поиск по смыслу, OCR, классификация).

## Стек

- **Framework**: Next.js 14 (App Router)
- **Язык**: TypeScript 5
- **ORM**: Prisma 6
- **БД**: PostgreSQL 16 (pgvector, pgcrypto)
- **Auth**: NextAuth.js (JWT, Credentials)
- **Storage**: S3-совместимые (Yandex Cloud, SberCloud, Selectel)
- **Платежи**: ЮKassa
- **AI**: YandexGPT, GigaChat, Ollama (через factory)

## Быстрый старт

### Терминал (локально)

```bash
# Установка
npm install

# Запуск PostgreSQL и Redis (Docker)
docker-compose up -d db redis

# Применение схемы БД
npx prisma db push

# Seed (админ: admin@qoqon.ru / admin123)
npx prisma db seed

# Dev-сервер
npm run dev
```

## Деплой на сервер

**Без GitHub Secrets** — всё через твой SSH.

1. Открой `deploy.sh` (Linux/Mac) или `deploy.ps1` (Windows) и укажи:
   - `VPS_HOST` — IP или домен сервера
   - `VPS_USER` — SSH-пользователь (например `root`)

2. Запусти деплой:
   - **Windows (PowerShell):** `.\deploy.ps1`
   - **Linux/Mac:** `./deploy.sh` или `npm run deploy`

Скрипт сделает: push на GitHub → SSH на сервер → git pull → npm ci → build → pm2 restart.

### Подготовка сервера (один раз, через Termius)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pm2
sudo npm install -g pm2

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE dropbox_ru OWNER postgres;"
```

## Структура проекта

```
src/
├── app/              # App Router
│   ├── (auth)/       # login, register
│   ├── dashboard/    # Личный кабинет
│   ├── admin/        # Админ-панель
│   └── api/          # API routes
├── components/       # UI, layout, providers
├── lib/              # prisma, auth, s3, config-store, ai
├── services/         # file, storage, search, ai
└── types/            # next-auth.d.ts, file.types, ai.types
```

## Админ-панель

- **S3** — настройки хранилища
- **ЮKassa** — платежи
- **AI-провайдеры** — YandexGPT, GigaChat, Ollama

## Лицензия

Proprietary.
