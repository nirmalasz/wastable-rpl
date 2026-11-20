# Build from the repo root:  docker build -f backend/Dockerfile .
# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Workspace manifests first, so the dependency layer is cached between code changes
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci -w backend --include-workspace-root=false

COPY backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src
RUN npm run build -w backend

# ---- Runtime stage ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci -w backend --include-workspace-root=false --omit=dev && npm cache clean --force

COPY --from=builder /app/backend/dist ./backend/dist
# SQL migrations, applied at startup (MIGRATE_ON_START)
COPY backend/drizzle ./backend/drizzle

# Local-disk uploads are only a fallback; production should set S3_BUCKET
RUN mkdir -p uploads && chown -R node:node /app
USER node

# Heroku sets PORT at runtime; 4000 is the local default
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
