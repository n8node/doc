#!/bin/sh
set -e
cd /app || exit 1
echo "Running Prisma migrations..."
PRISMA_CLI="/app/prisma-migrate-modules/node_modules/prisma/build/index.js"
if [ -f "$PRISMA_CLI" ]; then
  node "$PRISMA_CLI" migrate deploy || {
    echo "WARNING: Migration failed, continuing...";
  }
else
  echo "WARNING: Prisma CLI not found at $PRISMA_CLI, skip migrate"
fi
echo "Starting app..."
exec node server.js
