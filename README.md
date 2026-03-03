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

### Termius (сервер VPS)

```bash
# Подготовка
sudo apt update && sudo apt install -y docker.io docker-compose
cd /opt/dropbox-ru

# Деплой
docker-compose pull
docker-compose up -d
```

## Деплой одной командой

```bash
git push origin main
```

GitHub Actions собирает образ, пушит в registry и деплоит на VPS через SSH.

**Секреты в GitHub**: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `REGISTRY_HOST`, `REGISTRY_USER`, `REGISTRY_PASSWORD`, `NEXTAUTH_SECRET`.

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
