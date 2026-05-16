-- Schema ↔ migrations drift fix: COALESCE-tabanlı unique index'i
-- standart composite unique index ile değiştir. Schema.prisma'da artık
-- @@unique([code, organizationId]) ile belgelendi.
--
-- COALESCE trick'ini kaldırmamızın sebebi: Prisma DSL'de ifade edilemiyor,
-- her prisma migrate diff komutu "drift var" diyordu. Standart composite
-- index NULL'ları ayrı sayar (Postgres default) — bu bizim için sorun değil
-- çünkü global standartlar (NULL org) seed'den geliyor + ON CONFLICT koruması
-- var, eşzamanlı duplicate oluşturma riski yok.
--
-- Güvenlik notu: DROP + CREATE milisaniyeler sürer, veri kaybı olmaz, sadece
-- index yeniden oluşturulur.

DROP INDEX IF EXISTS "uq_accreditation_standards_code_org";

CREATE UNIQUE INDEX "uq_accreditation_standards_code_org"
  ON "accreditation_standards" ("code", "organization_id");
