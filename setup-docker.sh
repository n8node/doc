#!/bin/bash
# Установка Docker и запуск вспомогательных сервисов (Docling, Adminer)
# НЕ трогает PostgreSQL, Next.js и nginx
# Выполнить на сервере: bash /opt/dropbox-ru/setup-docker.sh

set -e

echo "=== 1/5 Установка Docker ==="
if command -v docker &> /dev/null; then
    echo "Docker уже установлен: $(docker --version)"
else
    apt-get update
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker установлен: $(docker --version)"
fi

echo ""
echo "=== 2/5 Проверка pgvector ==="
PG_HAS_VECTOR=$(sudo -u postgres psql -d dropbox_ru -tAc "SELECT 1 FROM pg_extension WHERE extname = 'vector'" 2>/dev/null || echo "")
if [ "$PG_HAS_VECTOR" = "1" ]; then
    echo "pgvector уже установлен"
else
    echo "pgvector не найден, устанавливаю..."
    PG_VERSION=$(pg_config --version | grep -oP '\d+' | head -1)
    apt-get install -y postgresql-${PG_VERSION}-pgvector
    sudo -u postgres psql -d dropbox_ru -c "CREATE EXTENSION IF NOT EXISTS vector;"
    echo "pgvector установлен"
fi

echo ""
echo "=== 3/5 Сборка Docling-сервиса (может занять 5-10 минут) ==="
cd /opt/dropbox-ru
docker compose -f docker-compose.services.yml build docling

echo ""
echo "=== 4/5 Запуск контейнеров ==="
docker compose -f docker-compose.services.yml up -d
sleep 5

echo ""
echo "=== 5/5 Проверка ==="
echo -n "Docling: "
curl -sf http://127.0.0.1:8000/health && echo "" || echo "ещё запускается (модели загружаются, подождите 1-2 минуты)"
echo -n "Adminer: "
curl -sf -o /dev/null -w "OK (порт 8080)" http://127.0.0.1:8080/ || echo "не запустился"
echo -n "pgvector: "
sudo -u postgres psql -d dropbox_ru -tAc "SELECT 'OK, version ' || extversion FROM pg_extension WHERE extname = 'vector'" 2>/dev/null || echo "не найден"

echo ""
echo "=== Добавь в .env ==="
grep -q "DOCLING_URL" /opt/dropbox-ru/.env 2>/dev/null || echo 'DOCLING_URL="http://127.0.0.1:8000"' >> /opt/dropbox-ru/.env
echo "DOCLING_URL установлен в .env"

echo ""
echo "=== Готово ==="
echo "Adminer:  http://127.0.0.1:8080 (или через nginx — см. README)"
echo "Docling:  http://127.0.0.1:8000/health"
echo ""
echo "Для nginx добавь location /adminer/ — см. инструкцию ниже:"
echo "  sudo nano /etc/nginx/sites-available/qoqon.ru"
echo "  (добавь блок location /adminer/ перед закрывающей })"
echo "  sudo nginx -t && sudo systemctl reload nginx"
