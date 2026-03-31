-- CreateTable: accreditation_standards (global — organizasyona bağlı değil)
CREATE TABLE "accreditation_standards" (
    "id"                          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"                        VARCHAR(50)  NOT NULL,
    "title"                       VARCHAR(500) NOT NULL,
    "description"                 TEXT,
    "standard_body"               VARCHAR(20)  NOT NULL,
    "required_training_categories" JSONB       NOT NULL DEFAULT '[]',
    "required_completion_rate"    INTEGER      NOT NULL DEFAULT 80,
    "is_active"                   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"                  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accreditation_standards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accreditation_standards_code_key" ON "accreditation_standards"("code");
CREATE INDEX "idx_accreditation_standards_body" ON "accreditation_standards"("standard_body");

-- CreateTable: accreditation_reports (organizasyona bağlı)
CREATE TABLE "accreditation_reports" (
    "id"                      UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"         UUID         NOT NULL,
    "title"                   VARCHAR(500) NOT NULL,
    "standard_body"           VARCHAR(20)  NOT NULL,
    "generated_at"            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by"            UUID         NOT NULL,
    "period_start"            TIMESTAMPTZ  NOT NULL,
    "period_end"              TIMESTAMPTZ  NOT NULL,
    "overall_compliance_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "findings"                JSONB        NOT NULL DEFAULT '[]',
    "report_url"              TEXT,
    "created_at"              TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accreditation_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_accreditation_reports_org" ON "accreditation_reports"("organization_id");
CREATE INDEX "idx_accreditation_reports_body" ON "accreditation_reports"("standard_body");
CREATE INDEX "idx_accreditation_reports_date" ON "accreditation_reports"("generated_at");

-- AddForeignKey
ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_generated_by_fkey"
    FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: JCI standartları
INSERT INTO "accreditation_standards" ("code", "title", "description", "standard_body", "required_training_categories", "required_completion_rate") VALUES
('JCI.SQE.3',  'Personel Eğitimi ve Yetkinlik',          'Tüm klinisyenler yetkinliklerini kanıtlamalıdır',                       'JCI',     '["enfeksiyon","hasta-haklari","genel"]',           80),
('JCI.PCI.9',  'Enfeksiyon Kontrolü',                    'El hijyeni ve izolasyon önlemleri eğitimi zorunludur',                   'JCI',     '["enfeksiyon"]',                                  90),
('JCI.FMS.7',  'Yangın Güvenliği ve Acil Durum',         'Yıllık yangın tatbikatı ve acil durum protokolleri',                    'JCI',     '["is-guvenligi","acil"]',                         85),
('JCI.AOP.5',  'Hasta Değerlendirme Standartları',       'Hasta değerlendirme prosedürleri için eğitim',                          'JCI',     '["hasta-haklari","genel"]',                        80),
('JCI.MMU.4',  'İlaç Yönetimi ve Güvenliği',             'İlaç uygulama hatalarını önleme eğitimi',                               'JCI',     '["eczane","genel"]',                              85),

('ISO.6.2',    'Yetkinlik, Farkındalık ve Eğitim',       'ISO 9001 — Personelin gerekli yetkinliklere sahip olması',               'ISO_9001','["genel","is-guvenligi"]',                        80),
('ISO.8.5',    'Üretim ve Hizmet Sunumu',                 'ISO 9001 — Kontrollü koşullarda hizmet sunumu',                         'ISO_9001','["genel","hasta-haklari"]',                       75),
('ISO.9.2',    'İç Tetkik',                               'ISO 9001 — Kalite yönetim sistemi iç denetimleri',                      'ISO_9001','["genel"]',                                       80),

('ISO15.5.4',  'Personel Eğitimi (Laboratuvar)',          'ISO 15189 — Laboratuvar personelinin teknik yetkinliği',                 'ISO_15189','["laboratuvar","genel"]',                       90),
('ISO15.5.5',  'Yetkinlik Değerlendirme',                 'ISO 15189 — Prosedürlerin yetkin personel tarafından yapılması',         'ISO_15189','["laboratuvar","radyoloji"]',                   85),
('ISO15.6.2',  'Preanalitik Süreçler',                   'ISO 15189 — Numune alma ve taşıma eğitimi',                             'ISO_15189','["laboratuvar","enfeksiyon"]',                   85),

('TJC.RC.02',  'Kayıt ve Dokümantasyon',                  'The Joint Commission — Tıbbi kayıt standartları',                       'TJC',     '["genel","hasta-haklari"]',                        80),
('TJC.IC.02',  'Enfeksiyon Önleme ve Kontrol',            'The Joint Commission — Enfeksiyon önleme programı',                     'TJC',     '["enfeksiyon"]',                                  90),
('TJC.NPSG.07','Ulusal Hasta Güvenliği Hedefleri — Enfeksiyon','El hijyeni uyumluluğu izleme ve raporlama',                       'TJC',     '["enfeksiyon","hasta-haklari"]',                   90),

('OSHA.1910.132','Kişisel Koruyucu Ekipman',              'OSHA — KKE seçimi, bakımı ve kullanımı eğitimi',                        'OSHA',    '["is-guvenligi"]',                                85),
('OSHA.1910.1030','Kan Kaynaklı Patojenler',              'OSHA — Kan yoluyla bulaşan hastalıklara maruz kalma standardı',          'OSHA',    '["enfeksiyon","is-guvenligi"]',                    90),
('OSHA.1910.146','Kısıtlı Alanlara Giriş',               'OSHA — İzin gerekli kısıtlı alanlara güvenli giriş prosedürleri',       'OSHA',    '["is-guvenligi"]',                                80);
