# NotebookLM Worker — Python (notebooklm-py + Playwright Chromium) + Node.js wrapper
#
# Multi-stage:
#   1) deps  — Node deps install
#   2) build — TS compile
#   3) final — Python + Chromium + compiled JS

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
# pnpm yerine npm — worker tek paket, lockfile root'ta değil
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npx tsc

FROM node:20-bookworm-slim AS final
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    NOTEBOOKLM_HOME=/data/.notebooklm-home \
    DATA_DIR=/data
WORKDIR /app

# Python + system deps for Chromium (Playwright)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      ca-certificates curl \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libcairo2 libasound2 libatspi2.0-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Python venv + notebooklm-py
RUN python3 -m venv /opt/notebooklm-venv \
    && /opt/notebooklm-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/notebooklm-venv/bin/pip install --no-cache-dir notebooklm-py playwright \
    && /opt/notebooklm-venv/bin/playwright install --with-deps chromium

ENV PATH="/opt/notebooklm-venv/bin:${PATH}"

# App
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Persistent volume mount point (Fly.io volume)
RUN mkdir -p /data && chmod 700 /data

EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/healthz || exit 1

CMD ["node", "dist/server.js"]
