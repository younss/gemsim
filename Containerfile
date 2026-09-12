# ============================================================================
# GEMSIM: PRODUCTION ROOTLESS CONTAINERFILE
# Multi-stage optimized build adhering to unprivileged execution (UID 10001)
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Builder
# ----------------------------------------------------------------------------
FROM docker.io/library/node:22-alpine AS builder

WORKDIR /build

# Install compilation essentials for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

# Copy root and workspace manifests
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies across packages
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy source trees
COPY server/tsconfig.json server/
COPY server/src/ server/src/
COPY client/ client/

# Build client SPA (emits into server/public)
RUN cd client && npm run build

# Build server TypeScript (emits into server/dist)
RUN cd server && npm run build

# Prune devDependencies in server
RUN cd server && npm prune --omit=dev

# ----------------------------------------------------------------------------
# Stage 2: Production Non-Root Runtime
# ----------------------------------------------------------------------------
FROM docker.io/library/node:22-alpine AS runner

LABEL maintainer="GemSim Platform Architects"
LABEL description="Enterprise Architecture & Strategic Operations Simulation SaaS"
LABEL version="1.0.0"

WORKDIR /app

# Security: Install curl for healthchecks, create non-root user (UID 10001)
RUN apk add --no-cache curl && \
    addgroup -g 10001 gemsim && \
    adduser -u 10001 -G gemsim -h /app -s /sbin/nologin -D gemsim

# Create persistent state directory for SQLite WAL
RUN mkdir -p /app/data && chown -R 10001:10001 /app

# Copy production node_modules and built bundles
COPY --chown=10001:10001 --from=builder /build/server/node_modules ./server/node_modules
COPY --chown=10001:10001 --from=builder /build/server/dist ./server/dist
COPY --chown=10001:10001 --from=builder /build/server/public ./server/public
COPY --chown=10001:10001 --from=builder /build/server/package.json ./server/package.json
COPY --chown=10001:10001 --from=builder /build/package.json ./package.json

# Environment variables
ENV NODE_ENV=production \
    PORT=8089 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    DB_PATH=/app/data/gemsim.db

# Drop privileges to non-root UID 10001
USER 10001:10001

EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8089/api/health || exit 1

CMD ["node", "server/dist/index.js"]
