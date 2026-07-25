FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV CI=true
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/.output ./.output
COPY --from=build /app/.nuxt ./.nuxt
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["node", ".output/server/index.mjs"]