-- CI/shadow-DB "auth" şeması shim'i — Supabase platform katmanını taklit eder.
--
-- Prod ve on-prem'de `auth` şeması + `auth.uid()`/`auth.jwt()` yardımcıları Supabase
-- platformu (GoTrue + supabase/postgres init) tarafından sağlanır. Sade `postgres`
-- CI servisinde bunlar YOKTUR. Migration'ların çoğu RLS bloklarını
-- `IF EXISTS (schema 'auth')` ile guard'lar ve sade postgres'te bu blokları atlar;
-- ancak 20260704120000_add_contact_messages guard'sız `auth.jwt()` çağırır →
-- replay sırasında "schema auth does not exist" (P3006) → drift-check + dr-drill kırılır.
--
-- Bu shim eksik şemayı/fonksiyonları/rolleri IDEMPOTENT kurar; böylece hem
-- `prisma migrate diff --from-migrations` (drift-check shadow replay) hem de
-- `prisma migrate deploy` (dr-drill) auth.* referanslarını çözebilir. Yalnız CI
-- ortamı içindir — uygulamanın çalışma-zamanı davranışını DEĞİŞTİRMEZ (RLS gerçek
-- yetki kontrolünü prod/on-prem Supabase'de yapar; bu stub'lar test DB'sinde policy'nin
-- yalnız OLUŞTURULABİLMESİ için tip-uyumlu imza sağlar).

CREATE SCHEMA IF NOT EXISTS auth;

-- Supabase auth.uid(): JWT 'sub' claim'inden uuid. Shadow/CI'da claim yok → NULL döner.
CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Supabase auth.jwt(): tüm JWT claim'leri jsonb. Shadow/CI'da claim yok → '{}' döner.
CREATE OR REPLACE FUNCTION auth.jwt()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

-- RLS policy'lerinin `TO <role>` hedefleri: sade postgres'te bu roller yok → CREATE POLICY
-- "role does not exist" verir. Idempotent oluştur (Supabase'deki gibi login'siz).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- auth.users — SADECE dr-drill CI job'u için (backup/restore auth.users'ı taşır: parola
-- hash geri-yükleme DR'nin kalbi). Gerçek Supabase auth.users çok kolonlu; burada yalnız
-- backup SELECT'inin çektiği + restore INSERT'inin yazdığı kolonlar (id + nullable gerisi).
-- Prisma bu tabloyu YÖNETMEZ (non-public şema) → drift-check'e görünmez. Migration'lar
-- auth.users'a dokunmaz; yalnız dr-drill.test.ts $executeRaw ile kullanır.
CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY,
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  phone              text,
  created_at         timestamptz,
  updated_at         timestamptz,
  raw_user_meta_data jsonb,
  raw_app_meta_data  jsonb
);
