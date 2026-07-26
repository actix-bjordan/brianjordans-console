# syntax=docker/dockerfile:1

# ---------- Build the SPA ----------
FROM node:24-alpine AS client-build
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ---------- Build the server ----------
FROM node:24-alpine AS server-build
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---------- Production dependencies only ----------
FROM node:24-alpine AS server-deps
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---------- Runtime ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    CLIENT_DIST=/srv/client

WORKDIR /srv

# node:alpine ships a `node` user (uid 1000); run as it rather than root.
COPY --from=server-deps --chown=node:node /build/server/node_modules ./node_modules
COPY --from=server-build --chown=node:node /build/server/dist ./dist
COPY --from=server-build --chown=node:node /build/server/package.json ./package.json
COPY --from=client-build --chown=node:node /build/app/dist ./client

USER node
EXPOSE 8080

# Compose and local runs get container-level health; the ALB uses its own check.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
