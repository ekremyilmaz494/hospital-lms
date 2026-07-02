#!/bin/sh
# MinIO bucket bootstrap — app'in video/belge yüklediği bucket'ı oluşturur.
# Idempotent: bucket varsa `mc mb` uyarı verir, script devam eder.
set -e

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing "local/${S3_BUCKET:-klinovax-media}"

# Private bucket (imzalı URL ile erişim) — anonim erişim KAPALI kalır.
mc anonymous set none "local/${S3_BUCKET:-klinovax-media}" || true

echo "[minio-init] Bucket hazır: ${S3_BUCKET:-klinovax-media}"
