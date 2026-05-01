-- AddColumn
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "openrouter_api_key_encrypted" TEXT;
