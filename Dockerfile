# =============================================================================
# Collct — Multi-stage Docker build
# =============================================================================
# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

# Install build tools for native modules (better-sqlite3 needs python + make + gcc)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV CI=true
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# =============================================================================
# Stage 2: Runtime
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

# Install pg_isready for DB health check
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy built output
COPY --from=builder /app/.output ./.output

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install build tools, then production deps, then remove build tools
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV CI=true
RUN apk add --no-cache python3 make g++ \
    && pnpm install --prod --frozen-lockfile \
    && apk del python3 make g++

# Create data directories
RUN mkdir -p /app/data/blobs /app/data/db

# Non-root user
RUN addgroup -g 1001 -S collct && \
    adduser -S collct -u 1001 -G collct && \
    chown -R collct:collct /app
USER collct

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    COLLCT_BLOB_DIR=/app/data/blobs \
    DATABASE_TYPE=postgresql

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
