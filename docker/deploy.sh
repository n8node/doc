#!/bin/bash
# Deploy script - rebuild app FIRST so migration files are up to date
set -e
cd "$(dirname "$0")/.."

echo ">>> git pull"
git pull

echo ">>> Rebuilding app (migrations are baked into image)"
docker compose build --no-cache app

echo ">>> Prisma migrate resolve (if needed)"
docker compose run --rm app npx -y prisma@6 migrate resolve --rolled-back 20250304000000_add_transcription_schema 2>/dev/null || true

echo ">>> Prisma migrate deploy"
docker compose run --rm app npx -y prisma@6 migrate deploy

echo ">>> docker compose up -d"
docker compose up -d

echo ">>> Done"
