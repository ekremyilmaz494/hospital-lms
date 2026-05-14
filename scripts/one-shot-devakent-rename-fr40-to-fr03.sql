-- ─────────────────────────────────────────────────────────────────────
-- Devakent: aktif "EY.FR.40" formunu "EY.FR.03" olarak yeniden kodla +
-- mevcut yanıtların formSnapshot'ındaki documentCode'u da EY.FR.03 yap.
--
-- Neden: kullanıcı PDF'te tüm yanıtlarda (geçmiş + yeni) tutarlı şekilde
-- "EY.FR.03" görmek istiyor. Form içeriği (sorular/kategoriler) korunur;
-- sadece kod ve metadata güncellenir.
--
-- Idempotent: WHERE document_code='EY.FR.40' filtresi sayesinde tekrar
-- çalıştırılırsa hiçbir şey yapmaz (zaten EY.FR.03 olanları görmez).
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- (1) Aktif EY.FR.40 formunu EY.FR.03 olarak yeniden kodla
UPDATE "training_feedback_forms"
SET "document_code"    = 'EY.FR.03',
    "published_at"     = '2026-01-07'::timestamptz,
    "revision_number"  = 0,
    "revision_date"    = NULL,
    "updated_at"       = NOW()
WHERE "organization_id" = (
        SELECT "id" FROM "organizations"
        WHERE LOWER("name") LIKE '%devakent%' LIMIT 1
      )
  AND "document_code" = 'EY.FR.40'
  AND "is_active"     = TRUE;

-- (2) Mevcut yanıtların formSnapshot JSON'undaki documentCode'unu güncelle
UPDATE "training_feedback_responses"
SET "form_snapshot" = jsonb_set(
  "form_snapshot"::jsonb,
  '{documentCode}',
  '"EY.FR.03"'::jsonb
)
WHERE "organization_id" = (
        SELECT "id" FROM "organizations"
        WHERE LOWER("name") LIKE '%devakent%' LIMIT 1
      )
  AND "form_snapshot" IS NOT NULL
  AND "form_snapshot"::jsonb->>'documentCode' = 'EY.FR.40';

COMMIT;
