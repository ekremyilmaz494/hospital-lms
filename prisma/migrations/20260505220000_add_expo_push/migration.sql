-- Expo Push Notifications: token kayıtları + ticket/receipt audit.
-- DB'de tablolar zaten var (db push ile direkt eklenmişti); idempotent
-- migration ile prisma migrate history'ye geri kazandırılıyor.

CREATE TABLE IF NOT EXISTS "expo_push_tokens" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       UUID         NOT NULL,
  "token"         TEXT         NOT NULL,
  "platform"      VARCHAR(10)  NOT NULL,
  "device_name"   VARCHAR(100),
  "last_seen_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "expo_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expo_push_tokens_token_key"
  ON "expo_push_tokens" ("token");

CREATE INDEX IF NOT EXISTS "idx_expo_push_tokens_user"
  ON "expo_push_tokens" ("user_id");

ALTER TABLE "expo_push_tokens"
  DROP CONSTRAINT IF EXISTS "expo_push_tokens_user_id_fkey",
  ADD CONSTRAINT "expo_push_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "expo_push_tickets" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"      TEXT         NOT NULL,
  "user_id"        UUID         NOT NULL,
  "token"          TEXT         NOT NULL,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "error_code"     VARCHAR(50),
  "error_details"  TEXT,
  "sent_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "receipt_at"     TIMESTAMPTZ,
  CONSTRAINT "expo_push_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expo_push_tickets_ticket_id_key"
  ON "expo_push_tickets" ("ticket_id");

CREATE INDEX IF NOT EXISTS "idx_expo_tickets_status_sent"
  ON "expo_push_tickets" ("status", "sent_at");

CREATE INDEX IF NOT EXISTS "idx_expo_tickets_user"
  ON "expo_push_tickets" ("user_id");

ALTER TABLE "expo_push_tickets"
  DROP CONSTRAINT IF EXISTS "expo_push_tickets_user_id_fkey",
  ADD CONSTRAINT "expo_push_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
