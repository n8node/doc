#!/bin/bash
# Настройка qoqon.ru на сервере
# Выполни в Termius после того как DNS qoqon.ru указывает на этот сервер

set -e

# 1. Установка nginx и certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Копируем конфиг (сначала только HTTP)
sudo cp /opt/dropbox-ru/nginx-qoqon.conf /etc/nginx/sites-available/qoqon.ru
sudo ln -sf /etc/nginx/sites-available/qoqon.ru /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t && sudo systemctl reload nginx

# 3. Получение SSL (certbot сам настроит nginx)
sudo certbot --nginx -d qoqon.ru -d www.qoqon.ru --non-interactive --agree-tos --email admin@qoqon.ru --redirect

# 4. Обновить .env
cd /opt/dropbox-ru
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="https://qoqon.ru"|' .env
sed -i 's|APP_URL=.*|APP_URL="https://qoqon.ru"|' .env

# 5. Перезапуск приложения
pm2 restart dropbox-ru

echo "Готово. Открой https://qoqon.ru"
