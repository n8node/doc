#!/usr/bin/env sh
# Выполнять на сервере в каталоге с docker-compose (например /opt/dropbox-ru).
# Включает в DS скачивание с приватных IP (http://app:3000/...) — см. DocumentServer issue #2268.
set -eu
cd "$(dirname "$0")/../.."
docker compose exec -T onlyoffice python3 - < docker/onlyoffice/patch-request-filter.py
docker compose restart onlyoffice
echo "Готово. Подождите ~30 с, откройте редактор и проверьте: docker compose logs app --since 1m | grep 'onlyoffice document'"
