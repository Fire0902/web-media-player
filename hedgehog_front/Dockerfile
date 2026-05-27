# syntax=docker/dockerfile:1.7

# ─── builder ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Inject the API base URL at build time. Defaults to "/api" so the produced
# bundle talks to the backend through the nginx reverse proxy on the same
# origin — handy for prod where you don't want to expose the AdonisJS port.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build-only

# ─── runner ──────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# SPA-aware nginx config with /api → backend reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx already runs as PID 1 with proper signal handling
CMD ["nginx", "-g", "daemon off;"]
