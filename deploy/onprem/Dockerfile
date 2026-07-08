# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# KlinoVax Hospital LMS — On-Premise imajı (multi-stage, source-minimized)
#
# pnpm monorepo; app apps/web'de. output:standalone (onprem build) sayesinde
# runner katmanı yalnız derlenmiş/minified server bundle + traced node_modules
# taşır (okunur src/ GİTMEZ — DRM değil, kaynak sızıntısını azaltır).
#
# Build (repo kökünden):
#   docker build -f deploy/onprem/Dockerfile -t klinovax/hospital-lms:onprem .
# ─────────────────────────────────────────────────────────────────────────────

# ── 1) deps: monorepo bağımlılıkları (Linux — sharp/@napi-rs/canvas doğru binary) ──
FROM node:22-bookworm AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
# Yalnız manifest'ler → lockfile katmanı cache'lenir
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
# tenants/tools workspace paketleri (varsa) — pnpm install için manifest şart
COPY tenants/ tenants/
COPY tools/ tools/
# --ignore-scripts: postinstall (prisma generate) şema henüz kopyalanmadığı için
# burada çalışamaz; build stage'de prisma generate zaten yapılır. sharp/@napi-rs
# prebuilt N-API — build script gerektirmez.
RUN pnpm install --frozen-lockfile --filter web... --ignore-scripts

# ── 2) build: onprem standalone çıktısı ──
FROM node:22-bookworm AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
# On-prem bayrağı BUILD-time gömülür (bundle'a). Supabase URL build'de zorunlu
# değil (guard onprem'de atlanır) ama Next public env inline için placeholder verilir;
# runtime env gerçek değeri sağlar (NEXT_PUBLIC_* runtime'da yeniden okunamaz →
# bu yüzden compose build-arg ile gerçek değerleri geçmek gerekebilir; README).
ARG NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=onprem-anon-placeholder
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_STORAGE_HOST=http://localhost:9000
ARG NEXT_PUBLIC_BASE_DOMAIN=localhost:3000
ENV NEXT_PUBLIC_DEPLOYMENT_MODE=onprem \
    DEPLOYMENT_MODE=onprem \
    NODE_ENV=production \
    CI=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096 \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STORAGE_HOST=$NEXT_PUBLIC_STORAGE_HOST \
    NEXT_PUBLIC_BASE_DOMAIN=$NEXT_PUBLIC_BASE_DOMAIN
WORKDIR /repo/apps/web
# prisma generate + next build (standalone). migrate deploy build'de DEĞİL —
# runtime entrypoint'te çalışır (DB o an ayakta).
RUN pnpm prisma generate && pnpm exec next build

# ── 3) runner: slim çalışma imajı ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app
# HOSTNAME=0.0.0.0: Next standalone HOSTNAME env'ine bind olur; konteyner
# kimliğine bind olursa healthcheck (curl localhost) ve compose ağı kırılır.
ENV NODE_ENV=production \
    NEXT_PUBLIC_DEPLOYMENT_MODE=onprem \
    DEPLOYMENT_MODE=onprem \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
# CHECKPOINT_DISABLE: Prisma CLI'nin her migrate deploy'da checkpoint.prisma.io'ya update-check
# denemesini kapatır → air-gap'te "dışarıya TEK bağlantı = LICENSE_SERVER_URL" taahhüdünü korur.
# Sağlık kontrolü + entrypoint bekleme için minimal araçlar
RUN apt-get update && apt-get install -y --no-install-recommends curl netcat-openbsd ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# NOT: runner'da pnpm/corepack YOK — migrate/bootstrap `npm` (node ile gelir) kullanır, server
# standalone `node`; runtime pnpm tüketicisi olmadığından ölü katman + gereksiz CVE yüzeyi kaldırıldı.

# supercronic — Vercel Cron yerine scheduler (binary imaja gömülür → airgap güvenli).
# Build sırasında (Klinovax'ta internet var) indirilir; teslim imajı offline çalışır.
ARG SUPERCRONIC_VERSION=v0.2.33
# İndirilen binary bütünlüğü SABİTLENMİŞ SHA256 ile doğrulanır: upstream release ele geçirilse
# bile (aynı etiket, değişmiş asset) build FAIL olur → trojan'lı scheduler binary'si (CRON_SECRET'a
# erişir, tüm cron uçlarını çağırabilir) hastane teslimat imajına GÖMÜLMEZ.
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) sc="supercronic-linux-amd64"; sha="feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671";; \
      arm64) sc="supercronic-linux-arm64"; sha="f1f8585c66de020fef494dd636058f99949d108f569fef00016a1c8b9eb145b3";; \
      *) echo "desteklenmeyen mimari $arch"; exit 1;; \
    esac; \
    curl -fsSLo /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/${sc}"; \
    echo "${sha}  /usr/local/bin/supercronic" | sha256sum -c -; \
    chmod +x /usr/local/bin/supercronic

# standalone server + static + public (fontlar/logolar runtime disk okunur!)
# Standalone monorepo layout: server.js apps/web/ altında, node_modules /app/ kökünde.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
# ── Migration çalıştırıcı (izole /app/migrate) ──
# Prisma 7 datasource url'i prisma.config.ts'ten okur ve config `prisma/config`'i
# import eder → prisma LOKAL kurulmalı (global npm node-resolution yolunda değil).
# İzole dizin: kendi node_modules/prisma + schema + migrations + dotenv'siz config.
COPY --from=build /repo/apps/web/prisma /app/migrate/prisma
COPY deploy/onprem/prisma.config.ts /app/migrate/prisma.config.ts
RUN cd /app/migrate && npm init -y >/dev/null 2>&1 \
    && npm install --no-audit --no-fund prisma@7.5.0

# İlk-boot bootstrap (self-contained .mjs). Next standalone, app deps'ini
# .next/server chunk'larına bundle'lar → @supabase/supabase-js/pg ayrı modül
# olarak node_modules'ta ÇÖZÜLEMEZ. Bu yüzden bootstrap'a KENDİ küçük node_modules'ını
# kurarız (build-time'da; offline imaja gömülür).
COPY --from=build /repo/apps/web/scripts/onprem-bootstrap.mjs /app/bootstrap/onprem-bootstrap.mjs
RUN cd /app/bootstrap && npm init -y >/dev/null 2>&1 \
    && npm install --no-audit --no-fund pg@8.20.0 @supabase/supabase-js@2.100.0

COPY deploy/onprem/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non-root çalıştırma (defense-in-depth): base imajın 'node' (uid 1000) kullanıcısı. Bir RCE'nin
# blast radius'unu küçültür (sırları/entrypoint'i root olarak ele geçirme + konteyner-kaçış zorlaşır).
# Standalone/static/public zaten COPY --chown=node ile node'a ait; yalnız Next'in çalışma-zamanında
# YAZDIĞI .next/cache dizinini node-yazılabilir yap (migrate/bootstrap node_modules root-owned kalır,
# world-read ile okunur). Port 3000 unprivileged; supercronic/prisma migrate root gerektirmez.
RUN mkdir -p /app/apps/web/.next/cache && chown node:node /app/apps/web/.next/cache
USER node

EXPOSE 3000
# server.js standalone'da apps/web/ altında (monorepo tracing).
# start-period=300s: ilk boot'ta postgres-bekle + ~85 migration deploy + gateway-bekle + bootstrap
# mütevazı donanımda 40s'yi kolayca aşar → start-period içi başarısızlık 'starting' sayılır,
# 'unhealthy' DAMGALAMAZ (operatörün kurulumu bozuk sanıp gereksiz down -v yapmasını önler).
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
