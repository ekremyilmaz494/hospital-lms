-- İletişim formu ve demo talep mesajlarını kalıcı olarak saklar.
-- Platform geneli (tenant-dışı) — organizationId yok. Sadece super_admin erişir.

-- CreateTable
CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" VARCHAR(30) NOT NULL DEFAULT 'contact',
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(30),
    "organization" VARCHAR(200),
    "staff_count" VARCHAR(20),
    "subject" VARCHAR(300),
    "message" TEXT,
    "ip_address" VARCHAR(45),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contact_messages_unread" ON "contact_messages" ("is_read", "created_at");
CREATE INDEX IF NOT EXISTS "idx_contact_messages_source" ON "contact_messages" ("source", "created_at");

-- Row Level Security — sadece super_admin
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_contact_messages_all" ON "contact_messages";
CREATE POLICY "super_admin_contact_messages_all" ON "contact_messages"
    FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
