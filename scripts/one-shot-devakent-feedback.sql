-- ─────────────────────────────────────────────────────────────────────
-- Tek seferlik Devakent SQL — manuel olarak çalıştırılır.
-- (1) Devakent eğitimlerindeki boş instructor_name'i 'Şehri Yılmaz' yap
-- (2) EY.FR.03 LMS formunu TASLAK (is_active=false) olarak Devakent'e ekle
--     — EY.FR.40 dokunulmaz; mevcut yanıtların form bağı korunur
--
-- Idempotent:
--   • (1): zaten dolu olanlara dokunulmaz (WHERE ile filtre)
--   • (2): EY.FR.03 zaten varsa ON CONFLICT yerine WHERE NOT EXISTS guard'ı
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- (1) Devakent eğitimlerinin eğitmen adını set et
UPDATE "trainings"
SET "instructor_name" = 'Şehri Yılmaz'
WHERE "organization_id" = (
        SELECT "id" FROM "organizations"
        WHERE LOWER("name") LIKE '%devakent%'
        LIMIT 1
      )
  AND ("instructor_name" IS NULL OR "instructor_name" = '');

-- (2) EY.FR.03 LMS taslak form (idempotent: zaten varsa atla)
WITH dev_org AS (
  SELECT "id" FROM "organizations"
  WHERE LOWER("name") LIKE '%devakent%'
  LIMIT 1
),
new_form AS (
  INSERT INTO "training_feedback_forms" (
    "organization_id", "title", "description", "document_code",
    "is_active", "is_mandatory", "is_archived",
    "published_at", "revision_number", "revision_date"
  )
  SELECT
    d."id",
    'Eğitim Değerlendirme Anket Formu',
    'Online eğitim sonrası personelin doldurduğu standart değerlendirme.',
    'EY.FR.03',
    FALSE,           -- TASLAK
    FALSE,
    FALSE,
    '2026-01-07'::timestamptz,
    0,
    NULL
  FROM dev_org d
  WHERE NOT EXISTS (
    SELECT 1 FROM "training_feedback_forms" f
    WHERE f."organization_id" = d."id"
      AND f."document_code" = 'EY.FR.03'
  )
  RETURNING "id"
),
cat1 AS (
  INSERT INTO "training_feedback_categories" ("form_id", "name", "order")
  SELECT "id", 'SİSTEM & KULLANILABİLİRLİK', 0 FROM new_form
  RETURNING "id"
),
cat2 AS (
  INSERT INTO "training_feedback_categories" ("form_id", "name", "order")
  SELECT "id", 'TEKNİK KALİTE', 1 FROM new_form
  RETURNING "id"
),
cat3 AS (
  INSERT INTO "training_feedback_categories" ("form_id", "name", "order")
  SELECT "id", 'GENEL DEĞERLENDİRME', 2 FROM new_form
  RETURNING "id"
),
i1 AS (
  INSERT INTO "training_feedback_items" ("category_id", "text", "question_type", "is_required", "order")
  SELECT "id", q.text, 'likert_5', TRUE, q.ord
  FROM cat1, (VALUES
    ('Sisteme giriş işlemleri kolaydı', 0),
    ('Programın kullanımı anlaşılırdı', 1),
    ('Eğitim platformu kullanıcı dostuydu', 2),
    ('Mobil cihaz / bilgisayar uyumluluğu yeterliydi', 3)
  ) AS q(text, ord)
  RETURNING 1
),
i2 AS (
  INSERT INTO "training_feedback_items" ("category_id", "text", "question_type", "is_required", "order")
  SELECT "id", q.text, 'likert_5', TRUE, q.ord
  FROM cat2, (VALUES
    ('Eğitim sırasında teknik sorun yaşamadım', 0),
    ('Ses ve görüntü kalitesi yeterliydi', 1)
  ) AS q(text, ord)
  RETURNING 1
),
i3 AS (
  INSERT INTO "training_feedback_items" ("category_id", "text", "question_type", "is_required", "order")
  SELECT "id", q.text, 'likert_5', TRUE, q.ord
  FROM cat3, (VALUES
    ('Sanal eğitim sistemi zaman açısından kolaylık sağladı', 0),
    ('Gelecekte bu yöntemle eğitim almaya devam etmek isterim', 1)
  ) AS q(text, ord)
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM new_form) AS forms_created,
  (SELECT COUNT(*) FROM i1) + (SELECT COUNT(*) FROM i2) + (SELECT COUNT(*) FROM i3) AS items_created;

COMMIT;
