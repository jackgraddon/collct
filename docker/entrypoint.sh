#!/bin/sh
set -e

echo "🚀 Collct — Starting..."

# ---------------------------------------------------------------------------
# Wait for database (PostgreSQL only)
# ---------------------------------------------------------------------------
if [ "${DATABASE_TYPE}" != "sqlite" ]; then
  DB_HOST="${DATABASE_HOST:-postgres}"
  DB_PORT="${DATABASE_PORT:-5432}"
  echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
    sleep 1
  done
  echo "✅ PostgreSQL is ready"
fi

# ---------------------------------------------------------------------------
# Ensure data directories exist
# ---------------------------------------------------------------------------
BLOB_DIR="${COLLCT_BLOB_DIR:-./data/blobs}"
mkdir -p "$BLOB_DIR"

if [ "${DATABASE_TYPE}" = "sqlite" ]; then
  SQLITE_DIR=$(dirname "${SQLITE_PATH:-./data/collct.db}")
  mkdir -p "$SQLITE_DIR"
fi

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
echo "📦 Running database migrations..."
if [ "${DATABASE_TYPE}" = "sqlite" ]; then
  echo "ℹ️  SQLite mode — migrations handled by NuxtHub at startup"
else
  # PostgreSQL: run migrations via drizzle-kit if DATABASE_URL is set
  if [ -n "$DATABASE_URL" ]; then
    npx drizzle-kit migrate --force 2>&1 || echo "⚠️  Migration step skipped (may already be applied)"
  fi
fi
echo "✅ Migrations complete"

# ---------------------------------------------------------------------------
# Start the application
# ---------------------------------------------------------------------------
echo "🎯 Starting Collct server..."
exec node .output/server/index.mjs
