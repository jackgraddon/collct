#!/bin/sh
set -e

echo "🚀 Collct — Starting..."

# ---------------------------------------------------------------------------
# Wait for database (PostgreSQL only, with timeout)
# ---------------------------------------------------------------------------
if [ "${DATABASE_TYPE}" != "sqlite" ] && [ -n "$DATABASE_URL" ]; then
  # Extract host and port from DATABASE_URL using Node.js for robust parsing
  DB_HOST=$(node -e "
    try {
      const u = new URL(process.argv[1]);
      console.log(u.hostname.replace(/^\[/, '').replace(/\]$/, ''));
    } catch { console.log('localhost'); }
  " "$DATABASE_URL")
  DB_PORT=$(node -e "
    try {
      const u = new URL(process.argv[1]);
      console.log(u.port || '5432');
    } catch { console.log('5432'); }
  " "$DATABASE_URL")

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
