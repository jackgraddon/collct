FROM node:20-alpine AS build

WORKDIR /app

# Install pnpm first
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN npx nuxt build && exit 0

# --- production ---
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S collct && adduser -S collct -G collct

COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && \
    mkdir -p /data/blob && chown -R collct:collct /app /data/blob

USER collct

EXPOSE 3000

ENV NODE_ENV=production
ENV NITRO_PORT=3000

ENTRYPOINT ["./docker-entrypoint.sh"]