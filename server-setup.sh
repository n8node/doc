#!/bin/bash
# Выполни на сервере через Termius (один раз для первичной установки)
# Потом для обновления используй server-pull.sh

set -e

sudo apt update
sudo apt install -y curl git

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pm2
sudo npm install -g pm2

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE dropbox_ru OWNER postgres;" 2>/dev/null || true

# Клон и билд
sudo mkdir -p /opt/dropbox-ru
sudo chown $USER:$USER /opt/dropbox-ru
cd /opt/dropbox-ru
if [ -d .git ]; then git pull origin main; else git clone https://github.com/n8node/doc.git .; fi

npm ci
npx prisma generate
npx prisma db push
npx prisma db seed
npm run build

pm2 start npm --name "dropbox-ru" -- start
pm2 save
pm2 startup

echo "Готово. Приложение на порту 3000"
