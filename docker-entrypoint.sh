#!/bin/sh
set -e

echo "[collct] Running database migrations..."
npx drizzle-kit migrate

echo "[collct] Starting server..."
exec node .output/server/index.mjs
