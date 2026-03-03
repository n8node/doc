#!/bin/bash
# Обновление на сервере (запускай после каждого git push)
# Выполни в Termius: bash -c "$(curl -sL https://raw.githubusercontent.com/n8node/doc/main/server-pull.sh)"
# Или скопируй и вставь:

cd /opt/dropbox-ru
git pull origin main
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart dropbox-ru
