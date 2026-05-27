# syntax=docker/dockerfile:1.7

# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# better-sqlite3 needs a toolchain to compile its native binding
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ─── builder ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Produce the production bundle under ./build
RUN node ace build

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

# ffmpeg is needed at runtime by ThumbnailService
RUN apk add --no-cache ffmpeg tini

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333

# Copy the AdonisJS build (which contains its own package.json + production
# install) and re-install only production dependencies.
COPY --from=builder /app/build ./
RUN npm ci --omit=dev && npm cache clean --force

# Persistent state and user-provided assets live in mounted volumes
RUN mkdir -p /app/tmp /app/media /app/public/thumbnails

EXPOSE 3333

# tini handles PID 1 / signal forwarding so Adonis shuts down cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "bin/server.js"]
