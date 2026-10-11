#!/bin/sh
set -e

echo "🚀 Collct — Starting..."

# ---------------------------------------------------------------------------
# Fix volume permissions (runs as root before dropping privileges)
# ---------------------------------------------------------------------------
BLOB_DIR="${COLLCT_BLOB_DIR:-/app/data/blobs}"
mkdir -p "$BLOB_DIR"
chown -R 1001:1001 /app/data 2>/dev/null || true

if [ "${DATABASE_TYPE}" = "sqlite" ]; then
  SQLITE_DIR=$(dirname "${SQLITE_PATH:-./data/collct.db}")
  mkdir -p "$SQLITE_DIR"
  chown -R 1001:1001 "$SQLITE_DIR" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Wait for database (PostgreSQL only, with timeout)
# ---------------------------------------------------------------------------
if [ "${DATABASE_TYPE}" != "sqlite" ] && [ -n "$DATABASE_URL" ]; then
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
# Apply database migrations
# ---------------------------------------------------------------------------
if [ -n "$DATABASE_URL" ] && [ -f "/app/docker/migrate.mjs" ]; then
  echo "🔄 Applying database migrations..."
  node /app/docker/migrate.mjs
fi

# ---------------------------------------------------------------------------
# Drop privileges and start the application
# ---------------------------------------------------------------------------
echo "🎯 Starting Collct server..."
exec su -s /bin/sh -c "exec node .output/server/index.mjs" collct
