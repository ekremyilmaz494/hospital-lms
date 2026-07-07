#!/bin/bash
# KlinoVax on-prem — Postgres ilk-init (YALNIZ fresh volume'de çalışır).
#
# supabase/postgres imajı standart docker-entrypoint kullanır ve
# /docker-entrypoint-initdb.d/ altındaki dosyaları ALFABETİK sırayla işler. Bu dosya
# `zz-` önekiyle imajın kendi `migrate.sh`'ından SONRA çalışır → supabase rolleri
# (supabase_auth_admin, supabase_admin, …) çoktan oluşturulmuştur.
#
# İki "supabase'i kendi compose'unun dışında self-host etme" tuzağını kapatır:
#   1) PAROLA SENKRONU — imaj, alt-rol parolalarını POSTGRES_PASSWORD ile senkronlamaz.
#      GoTrue (supabase_auth_admin) ve Realtime (supabase_admin) AĞ (scram-sha-256)
#      üzerinden bağlandığından "password authentication failed" (28P01) alır ve
#      crash-loop'a girer. Rolleri reserved (yalnız superuser değiştirebilir) olduğundan
#      DATABASE_URL rolü `postgres` (superuser DEĞİL) bunları düzeltemez; bu yüzden
#      bootstrap superuser `supabase_admin` ile (loopback = pg_hba `trust`, parolasız)
#      bağlanıp parolaları POSTGRES_PASSWORD'e eşitleriz.
#   2) PRISMA BASELINE (P3005) — Realtime, app'in `prisma migrate deploy`'undan ÖNCE
#      public'e kendi tablolarını (tenants/extensions/schema_migrations) basarsa Prisma
#      "The database schema is not empty" (P3005) verip migrate'i reddeder (app depends_on'da
#      realtime yok → yarış). Boş `_prisma_migrations` baseline tablosunu önden oluşturmak
#      migrate deploy'un 79 migration'ı sorunsuz uygulamasını sağlar (sahiplik app rolü).
set -euo pipefail

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD gerekli}"
APP_DB_ROLE="postgres"   # DATABASE_URL bu rolle bağlanır → baseline tablosu bu role ait olmalı

# supabase_admin = superuser; ilk-init sırasında local socket pg_hba `trust` → parolasız
# superuser bağlantısı (reserved rolleri değiştirebilen tek yol).
psql -v ON_ERROR_STOP=1 --username supabase_admin --dbname "${POSTGRES_DB:-postgres}" <<SQL
-- (1) Alt-rol parolalarını POSTGRES_PASSWORD'e eşitle (GoTrue/Realtime ağ bağlantısı için)
ALTER USER supabase_auth_admin        WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER USER supabase_storage_admin     WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER USER supabase_admin             WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER USER supabase_replication_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER USER authenticator              WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER USER pgbouncer                  WITH PASSWORD '${POSTGRES_PASSWORD}';

-- (2) Prisma baseline: boş _prisma_migrations (P3005 yarışını kapatır; owner = app rolü)
CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE public."_prisma_migrations" OWNER TO ${APP_DB_ROLE};
SQL

echo "[onprem-db-init] Alt-rol parolaları POSTGRES_PASSWORD ile senkronlandı + Prisma baseline hazır."
