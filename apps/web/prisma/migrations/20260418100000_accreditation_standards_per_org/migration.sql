-- Hospital-specific accreditation standards: nullable organization_id + composite unique
ALTER TABLE "accreditation_standards"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "accreditation_standards"
  DROP CONSTRAINT IF EXISTS "accreditation_standards_code_key";

-- (code, organization_id) unique — NULL org'lar için COALESCE ile treat as empty string
CREATE UNIQUE INDEX IF NOT EXISTS "uq_accreditation_standards_code_org"
  ON "accreditation_standards" ("code", COALESCE("organization_id"::text, ''));

CREATE INDEX IF NOT EXISTS "idx_accreditation_standards_org"
  ON "accreditation_standards" ("organization_id");

ALTER TABLE "accreditation_standards"
  DROP CONSTRAINT IF EXISTS "accreditation_standards_organization_id_fkey",
  ADD CONSTRAINT "accreditation_standards_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accreditation_standards"
  DROP CONSTRAINT IF EXISTS "accreditation_standards_created_by_fkey",
  ADD CONSTRAINT "accreditation_standards_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Eksik global standartları seed et (JCI dışı bodyler prod'da eksikti)
INSERT INTO "accreditation_standards" ("id", "code", "title", "description", "standard_body", "required_training_categories", "required_completion_rate")
VALUES
  (gen_random_uuid(), 'ISO.6.2',       'Yetkinlik, Farkındalık ve Eğitim',          'ISO 9001 — Personelin gerekli yetkinliklere sahip olması',               'ISO_9001',  '["genel","is-guvenligi"]'::jsonb, 80),
  (gen_random_uuid(), 'ISO.8.5',       'Üretim ve Hizmet Sunumu',                   'ISO 9001 — Kontrollü koşullarda hizmet sunumu',                          'ISO_9001',  '["genel","hasta-haklari"]'::jsonb, 75),
  (gen_random_uuid(), 'ISO.9.2',       'İç Tetkik',                                 'ISO 9001 — Kalite yönetim sistemi iç denetimleri',                       'ISO_9001',  '["genel"]'::jsonb, 80),
  (gen_random_uuid(), 'ISO15.5.4',     'Personel Eğitimi (Laboratuvar)',            'ISO 15189 — Laboratuvar personelinin teknik yetkinliği',                 'ISO_15189', '["laboratuvar","genel"]'::jsonb, 90),
  (gen_random_uuid(), 'ISO15.5.5',     'Yetkinlik Değerlendirme',                   'ISO 15189 — Prosedürlerin yetkin personel tarafından yapılması',         'ISO_15189', '["laboratuvar","radyoloji"]'::jsonb, 85),
  (gen_random_uuid(), 'ISO15.6.2',     'Preanalitik Süreçler',                      'ISO 15189 — Numune alma ve taşıma eğitimi',                              'ISO_15189', '["laboratuvar","enfeksiyon"]'::jsonb, 85),
  (gen_random_uuid(), 'TJC.RC.02',     'Kayıt ve Dokümantasyon',                    'The Joint Commission — Tıbbi kayıt standartları',                        'TJC',       '["genel","hasta-haklari"]'::jsonb, 80),
  (gen_random_uuid(), 'TJC.IC.02',     'Enfeksiyon Önleme ve Kontrol',              'The Joint Commission — Enfeksiyon önleme programı',                      'TJC',       '["enfeksiyon"]'::jsonb, 90),
  (gen_random_uuid(), 'TJC.NPSG.07',   'Ulusal Hasta Güvenliği Hedefleri',          'El hijyeni uyumluluğu izleme ve raporlama',                              'TJC',       '["enfeksiyon","hasta-haklari"]'::jsonb, 90),
  (gen_random_uuid(), 'OSHA.1910.132', 'Kişisel Koruyucu Ekipman',                  'OSHA — KKE seçimi, bakımı ve kullanımı eğitimi',                         'OSHA',      '["is-guvenligi"]'::jsonb, 85),
  (gen_random_uuid(), 'OSHA.1910.1030','Kan Kaynaklı Patojenler',                   'OSHA — Kan yoluyla bulaşan hastalıklara maruz kalma standardı',          'OSHA',      '["enfeksiyon","is-guvenligi"]'::jsonb, 90),
  (gen_random_uuid(), 'OSHA.1910.146', 'Kısıtlı Alanlara Giriş',                    'OSHA — İzin gerekli kısıtlı alanlara güvenli giriş prosedürleri',        'OSHA',      '["is-guvenligi"]'::jsonb, 80)
ON CONFLICT DO NOTHING;
