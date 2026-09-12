# Symlink / Copy of Containerfile for universal tool compatibility
# See Containerfile for full multi-stage non-root build documentation
FROM docker.io/library/node:22-alpine AS builder
WORKDIR /build
RUN apk add --no-cache python3 make g++
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install && cd server && npm install && cd ../client && npm install
COPY server/tsconfig.json server/
COPY server/prisma/ server/prisma/
COPY server/src/ server/src/
COPY client/ client/
RUN cd server && npx prisma generate
RUN cd client && npm run build
RUN cd server && npm run build
RUN cd server && npm prune --omit=dev

FROM docker.io/library/node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl && \
    addgroup -g 10001 gemsim && \
    adduser -u 10001 -G gemsim -h /app -s /sbin/nologin -D gemsim
RUN mkdir -p /app/data && chown -R 10001:10001 /app
COPY --chown=10001:10001 --from=builder /build/server/node_modules ./server/node_modules
COPY --chown=10001:10001 --from=builder /build/server/dist ./server/dist
COPY --chown=10001:10001 --from=builder /build/server/public ./server/public
COPY --chown=10001:10001 --from=builder /build/server/package.json ./server/package.json
COPY --chown=10001:10001 --from=builder /build/package.json ./package.json

ENV NODE_ENV=production \
    PORT=8089 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    DB_PATH=/app/data/gemsim.db

USER 10001:10001
EXPOSE 8089
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8089/api/health || exit 1
CMD ["node", "server/dist/index.js"]
