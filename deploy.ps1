# Деплой с Windows (PowerShell)
# .\deploy.ps1

$ErrorActionPreference = "Stop"

# === ДАННЫЕ СЕРВЕРА ===
$VPS_HOST = "155.212.230.150"
$VPS_USER = "root"
$REMOTE_DIR = "/opt/dropbox-ru"

Write-Host "Деплой на $VPS_USER@$VPS_HOST"
git push origin main

$script = @"
set -e
if [ ! -d $REMOTE_DIR ]; then
  sudo mkdir -p $REMOTE_DIR
  sudo chown `$USER:`$USER $REMOTE_DIR
  git clone https://github.com/n8node/doc.git $REMOTE_DIR
fi
cd $REMOTE_DIR
git pull origin main
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart dropbox-ru 2>/dev/null || pm2 start npm --name dropbox-ru -- start
echo Деплой завершён.
"@

ssh "$VPS_USER@$VPS_HOST" $script
