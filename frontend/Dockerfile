# Build from the repo root:
#   docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://<api-app>.herokuapp.com/api .
# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci -w frontend --include-workspace-root=false

COPY frontend/next.config.ts frontend/tsconfig.json frontend/postcss.config.mjs ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" && exit 1)
RUN npm run build -w frontend

# ---- Runtime stage: Next.js standalone server, no node_modules install needed ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Listen on all interfaces; Heroku provides PORT at runtime
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public
USER node

EXPOSE 3000
CMD ["node", "frontend/server.js"]
