-- AI İçerik Stüdyosu v2 modülü tamamen kaldırıldı (NotebookLM + worker + UI).
-- v1 cleanup migration (20260423170000_drop_ai_content_studio) tarihsel kayıt
-- olarak korundu. Bu migration v2'de eklenen tabloları drop ediyor.
--
-- ai_generations → ai_notebook_accounts (FK org → users değil ama Cascade ile temiz drop)

DROP TABLE IF EXISTS "ai_generations" CASCADE;
DROP TABLE IF EXISTS "ai_notebook_accounts" CASCADE;
