-- Org-bazında personel (seat) limiti. null = plan limitine düş / sınırsız.
-- Fresh DB'de de güvenli: IF NOT EXISTS ile idempotent.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_staff" INTEGER;
