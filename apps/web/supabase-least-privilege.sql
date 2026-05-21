-- ════════════════════════════════════════════════════════════════════════
--  supabase-least-privilege.sql
--  P0.5 — auth şeması üzerinde yıkıcı yetki daraltma (least privilege)
-- ════════════════════════════════════════════════════════════════════════
--
--  NEDEN VAR
--  ─────────
--  2026-05-20 incident'inde `wipe-auth-users.ts`, uygulamanın bağlandığı
--  `postgres` rolüyle prod'da şunu çalıştırdı:
--
--      DELETE FROM auth.users WHERE NOT EXISTS (...)
--
--  Sonuç: 143 personelin parola hash'i silindi, hastane sisteme kilitlendi.
--  Kök sebeplerden biri: uygulamanın günlük kullandığı `postgres` rolü
--  `auth.users` üzerinde DELETE yetkisine sahipti. Bu script o yetkiyi alır —
--  kazara bir `DELETE FROM auth.users` artık "permission denied" ile reddedilir.
--
--  GÜVENLİ Mİ?  EVET — kanıtla:
--  ────────────────────────────
--    • schema.prisma'da `multiSchema` YOK → tüm Prisma modelleri `public`
--      şemada. Uygulama auth tablolarını Prisma ORM ile hiç kullanmaz.
--    • `apps/web/src` taramasında auth şemasına tek YAZMA yok. Tek dokunuş:
--      `api/cron/backup/route.ts` → `SELECT ... FROM auth.users` (yedek okuma).
--    • auth tablolarına yazan tek bileşen Supabase'in kendi Auth servisidir;
--      o `supabase_auth_admin` rolünü kullanır — `postgres`'i DEĞİL.
--    • Bu yüzden aşağıda SELECT bilinçli olarak BIRAKILIR (backup çalışsın),
--      yalnızca DELETE / TRUNCATE / UPDATE alınır.
--
--  ⚠️  UYGULAMA SIRASI — ÖNEMLİ
--  ────────────────────────────
--  Bu script ÖNCE local Supabase'de (bkz. docs/local-development.md, P0.1)
--  çalıştırılıp doğrulanmalı, SONRA prod'a uygulanmalıdır. Test edilmemiş bir
--  DB değişikliğini doğrudan prod'da çalıştırmak, incident'in tam olarak
--  tekrarıdır. Sıra:  local'de çalıştır → ADIM 2 doğrula → prod'a uygula.
--
--  PROD'A UYGULAMA
--  ───────────────
--  Supabase Dashboard → SQL Editor. ADIM 1'deki REVOKE'lar yetki hatası
--  verirse, Editor'de daraltıcı role geç:  `SET ROLE supabase_admin;` ... ;
--  (local'de zaten görürsün — orada `postgres` çoğu yetkiye sahiptir.)
--
--  BREAK-GLASS (bilinçli, istisnai yıkıcı işlem gerekirse)
--  ───────────────────────────────────────────────────────
--  auth.users üzerinde kasıtlı bir yıkıcı işlem gerekirse `supabase_auth_admin`
--  rolü her zaman tam yetkilidir (auth şemasının sahibi). Dashboard SQL
--  Editor'de:   SET ROLE supabase_auth_admin;  <işlem>;  RESET ROLE;
--  Not: parola sıfırlama / kullanıcı oluşturma gibi NORMAL işlemler zaten
--  Supabase Auth Admin API üzerinden yapılır — raw SQL'e gerek yoktur.
-- ════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- ADIM 0 — ÖNCE İNCELE  (hiçbir şeyi değiştirmez; sadece mevcut durumu gör)
-- ────────────────────────────────────────────────────────────────────────
-- `postgres` rolünün auth şemasındaki tablolarda hangi yetkileri var?
-- Çıktıda DELETE / UPDATE / TRUNCATE satırları görüyorsan — açık kapı budur.
SELECT table_name, privilege_type
FROM   information_schema.role_table_grants
WHERE  grantee = 'postgres'
  AND  table_schema = 'auth'
ORDER  BY table_name, privilege_type;


-- ────────────────────────────────────────────────────────────────────────
-- ADIM 1 — YETKİYİ DARALT
-- ────────────────────────────────────────────────────────────────────────
-- auth şemasındaki MEVCUT tüm tablolardan yıkıcı yetkileri al.
-- SELECT ve INSERT bilinçli BIRAKILIR:
--   • SELECT  → backup route'u auth.users'ı okuyor (bozulmasın).
--   • INSERT  → incident sınıfı değil; istersen bu satıra INSERT ekleyebilirsin.
-- REVOKE idempotent'tir — script tekrar çalıştırılabilir, hata vermez.
REVOKE DELETE, TRUNCATE, UPDATE
  ON ALL TABLES IN SCHEMA auth
  FROM postgres;

-- ADIM 1b (opsiyonel, düşük öncelik) — Supabase ileride auth şemasına YENİ
-- bir tablo eklerse, o tabloda da `postgres`'e yıkıcı yetki otomatik düşmesin.
-- Bu komut `supabase_auth_admin` üyeliği/yetkisi ister; "permission denied"
-- verirse ATLA — yalnızca gelecekteki auth tablolarını etkiler, asıl koruma
-- ADIM 1'dir. Dashboard'da gerekiyorsa: SET ROLE supabase_admin; <komut>; RESET ROLE;
ALTER DEFAULT PRIVILEGES
  FOR ROLE supabase_auth_admin IN SCHEMA auth
  REVOKE DELETE, TRUNCATE, UPDATE ON TABLES FROM postgres;


-- ────────────────────────────────────────────────────────────────────────
-- ADIM 2 — DOĞRULA  (ADIM 1'den sonra tekrar çalıştır)
-- ────────────────────────────────────────────────────────────────────────
-- Beklenen: çıktıda artık DELETE / UPDATE / TRUNCATE satırı YOK; yalnızca
-- SELECT (ve varsa INSERT / REFERENCES / TRIGGER) kalmalı.
SELECT table_name, privilege_type
FROM   information_schema.role_table_grants
WHERE  grantee = 'postgres'
  AND  table_schema = 'auth'
  AND  privilege_type IN ('DELETE', 'TRUNCATE', 'UPDATE')
ORDER  BY table_name, privilege_type;
-- ↑ Bu sorgu HİÇ satır döndürmemeli. Satır dönerse REVOKE tutmamıştır.

-- Kanıt testi (yalnızca LOCAL'de çalıştır — prod'da gerek yok):
-- Aşağıdaki komut artık şu hatayı vermeli:
--   ERROR: permission denied for table users
-- WHERE false hiçbir satır etkilemez; yine de yetki kontrolü önce yapılır.
--   DELETE FROM auth.users WHERE false;


-- ════════════════════════════════════════════════════════════════════════
--  GERİ ALMA  (yalnızca bir şey beklenmedik şekilde bozulursa)
--  Normalde gerekmez. Çalıştırmak için baştaki "-- " işaretlerini kaldır.
-- ════════════════════════════════════════════════════════════════════════
-- GRANT DELETE, TRUNCATE, UPDATE ON ALL TABLES IN SCHEMA auth TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
--   GRANT DELETE, TRUNCATE, UPDATE ON TABLES TO postgres;


-- ════════════════════════════════════════════════════════════════════════
--  İLERİ ADIM (P1/P2 — bu script'in kapsamı DIŞINDA, not olarak)
-- ════════════════════════════════════════════════════════════════════════
--  Daha kapsamlı least-privilege: uygulamayı `postgres` yerine yalnızca
--  `public` şemaya yetkili, ayrı bir DB rolüyle (ör. `hospital_lms_app`)
--  bağlamak. `postgres` o zaman tamamen "break-glass" rolü olur. Bu, bağlantı
--  string'i + RLS davranışı değişikliği gerektirir; ayrı planlanıp local'de
--  test edilmelidir. Bu script o adıma kadar olan kazara-silme riskini kapatır.
