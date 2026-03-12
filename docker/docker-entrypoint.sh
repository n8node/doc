#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx -y prisma@6 migrate deploy || { echo "WARNING: Migration failed, continuing..."; }
echo "Starting app..."
exec node server.js
