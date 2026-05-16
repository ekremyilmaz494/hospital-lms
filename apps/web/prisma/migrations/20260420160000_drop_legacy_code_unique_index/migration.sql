-- Legacy UNIQUE INDEX 'accreditation_standards_code_key' drift temizliği.
--
-- Orijinal migration (20260330_add_accreditation) 'code' kolonuna UNIQUE INDEX
-- olarak oluşturmuştu. Sonraki per_org migration 'DROP CONSTRAINT IF EXISTS'
-- ile silmeye çalıştı ama Postgres'te UNIQUE INDEX bir CONSTRAINT değil — DROP
-- CONSTRAINT çalışmadı, orphan index kaldı. Schema.prisma artık sadece
-- composite (code, organization_id) unique tanımlıyor, 'code'-only unique YOK.
-- Fresh DB'de bu orphan index oluştuğu için CI 'migrate diff' drift raporluyor.
--
-- Bu migration orphan index'i IF EXISTS ile siler. Prod DB'de zaten silinmiş
-- olabilir (20260418 per_org çalıştıysa DROP CONSTRAINT no-op oldu ama index
-- kaldı; 20260418 DROP CONSTRAINT'i başarılıysa index de gitmiş olabilir —
-- IF EXISTS her iki durumu da güvenli handle eder).

DROP INDEX IF EXISTS "accreditation_standards_code_key";
