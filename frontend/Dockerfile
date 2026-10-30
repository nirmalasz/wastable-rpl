# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root lockfile and package definitions
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies with root workspace context
RUN npm ci

# Copy frontend source
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/next.config.js ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/postcss.config.js ./frontend/ 2>/dev/null || true
COPY frontend/tailwind.config.js ./frontend/ 2>/dev/null || true

# Build Next.js app with build argument
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build -w frontend

# Runtime stage
FROM node:24-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy workspace root lockfile and package definitions
COPY package*.json ./
COPY frontend/package.json ./frontend/

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/next.config.js ./frontend/

# Fix ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "frontend"]
