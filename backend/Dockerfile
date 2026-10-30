# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root lockfile and package definitions
COPY package*.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies with root workspace context
RUN npm ci

# Copy backend source
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY backend/tsconfig.build.json ./backend/

# Build backend
RUN npm run build -w backend

# Runtime stage
FROM node:24-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy workspace root lockfile and package definitions
COPY package*.json ./
COPY backend/package.json ./backend/

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/backend/dist ./backend/dist

# Create and own uploads directory
RUN mkdir -p uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 4000

CMD ["node", "backend/dist/server.js"]
