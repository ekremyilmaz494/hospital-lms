---
description: RLS policy denetimi — schema.prisma'daki tablolar ile supabase-rls.sql arasında eşleşme kontrolü
allowed-tools: Bash, Read, Grep
---

# /check-rls

CLAUDE.md kuralı: **"Yeni tablo → `supabase-rls.sql`'a RLS policy ekle"**. Bu komut yeni eklenen ama RLS policy'si olmayan tabloları tespit eder.

## Görev

1. `prisma/schema.prisma` dosyasından tüm `model X { ... @@map("table_name") }` çiftlerini çıkar.
2. `supabase-rls.sql` dosyasından `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` ve `CREATE POLICY ... ON <name>` satırlarını çıkar.
3. Karşılaştır:
   - 🔴 RLS hiç enable edilmemiş tablolar
   - 🟠 RLS enable ama policy tanımlı değil
   - 🟡 Policy var ama `organizationId` referansı yok (büyük ihtimal yanlış)
4. Her bulgu için CLAUDE.md'deki şablon politikayı (organizationId kontrolü) öner.

## Çıktı formatı

```
📊 Toplam tablo: N
✅ Tam korumalı: M
🔴 RLS yok:
  - new_feature_table
🟠 RLS var, policy yok:
  - audit_log_v2
🟡 Policy şüpheli (organizationId yok):
  - certificates  → policy "cert_select" üzerinde organizationId filtresi yok
```

## Önerilen çözüm bloğu

Eksik tablolar için bu şablonu öner:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_isolation" ON <table>
  FOR ALL
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
```

`$ARGUMENTS` boşsa tümünü tara, doluysa sadece o tablo adı için kontrol et.
