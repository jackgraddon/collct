FROM node:lts AS build-stage
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --ignore-scripts && pnpm install || true
COPY . .
RUN CI=true pnpm run build

FROM node:lts AS prod-stage
WORKDIR /app
COPY --from=build-stage /app/.output/ ./.output/
CMD [ "node", ".output/server/index.mjs" ]
