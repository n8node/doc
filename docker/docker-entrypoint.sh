#!/bin/sh
set -e
cd /app || exit 1
echo "Running Prisma migrations..."
if [ -f "./node_modules/prisma/build/index.js" ]; then
  node ./node_modules/prisma/build/index.js migrate deploy || {
    echo "WARNING: Migration failed, continuing...";
  }
else
  echo "WARNING: Prisma CLI not found at node_modules/prisma/build/index.js, skip migrate"
fi
echo "Starting app..."
exec node server.js
