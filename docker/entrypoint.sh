#!/bin/sh
set -e

echo "🚀 Collct — Starting..."

# ---------------------------------------------------------------------------
# Wait for database (PostgreSQL only, with timeout)
# ---------------------------------------------------------------------------
if [ "${DATABASE_TYPE}" != "sqlite" ] && [ -n "$DATABASE_URL" ]; then
  # Extract host and port from DATABASE_URL if available
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):\([0-9]*\).*|\2|p')
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"

  echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} (timeout: 30s)..."

  WAIT=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
    WAIT=$((WAIT + 1))
    if [ "$WAIT" -ge 30 ]; then
      echo "⚠️  PostgreSQL not reachable after 30s — starting anyway"
      break
    fi
    sleep 1
  done

  if [ "$WAIT" -lt 30 ]; then
    echo "✅ PostgreSQL is ready"
  fi
else
  echo "ℹ️  No DATABASE_URL set — skipping DB wait"
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
# Start the application
# ---------------------------------------------------------------------------
echo "🎯 Starting Collct server..."
exec node .output/server/index.mjs
