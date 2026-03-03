#!/bin/bash
# Локальный деплой: ./deploy.sh
# Заполни VPS_HOST и VPS_USER или пропиши в deploy.config

set -e

# === НАСТРОЙКИ: отредактируй ниже или создай deploy.config ===
VPS_HOST="${VPS_HOST:-твой-сервер.ru}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="/opt/dropbox-ru"
[ -f deploy.config ] && source deploy.config

echo "Деплой на $VPS_USER@$VPS_HOST:$REMOTE_DIR"

# Сначала пушим на GitHub
git push origin main

# Потом на сервер
ssh "$VPS_USER@$VPS_HOST" << EOF
  set -e
  if [ ! -d $REMOTE_DIR ]; then
    sudo mkdir -p $REMOTE_DIR
    sudo chown \$USER:\$USER $REMOTE_DIR
    git clone https://github.com/n8node/doc.git $REMOTE_DIR
  fi
  cd $REMOTE_DIR
  git pull origin main
  npm ci
  npx prisma generate
  npx prisma db push
  npm run build
  pm2 restart dropbox-ru 2>/dev/null || pm2 start npm --name "dropbox-ru" -- start
  echo "Деплой завершён."
EOF
