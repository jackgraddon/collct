FROM node:20-alpine AS build

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build with CI mode (no watchers, clean exit)
ENV CI=true
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm in runtime
RUN npm install -g pnpm

# Copy lock file and package.json
COPY pnpm-lock.yaml package.json ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built app from build stage
COPY --from=build /app/.output ./.output
COPY --from=build /app/.nuxt ./.nuxt

# Expose port
EXPOSE 3000

# Run the app
CMD ["node", ".output/server/index.mjs"]