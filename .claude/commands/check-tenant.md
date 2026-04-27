---
description: Multi-tenant izolasyon denetimi — organizationId filtresi olmayan Prisma sorgularını bul
allowed-tools: Bash, Read, Grep
---

# /check-tenant

Hospital LMS multi-tenant SaaS — her Prisma sorgusunda `organizationId` filtresi **ZORUNLU** (bkz. CLAUDE.md "Multi-Tenant Güvenlik" bölümü).

## Görev

Bu komut çalıştırıldığında:

1. `src/app/api/` ve `src/lib/` altında `prisma.<model>.findMany|findFirst|findUnique|update|delete|count|aggregate|groupBy` çağrılarını ara.
2. Her çağrının `where` bloğunda `organizationId` filtresi var mı kontrol et.
3. Eksik olanları **dosya:satır** formatında listele.
4. Her bulgu için olası riski (cross-tenant data leak) kısaca açıkla.
5. Beyaz liste: `super-admin/*` route'ları (platform geneli sorgu yapabilir) ve `prisma.user.findUnique({ where: { id }})` gibi tek-kullanıcı PK lookup'ları — bu durumlar uyarıdan hariç tutulabilir ama yine de raporda "muaf" olarak göster.

## Çıktı formatı

```
🔴 KRİTİK (organizationId yok):
  - src/app/api/.../route.ts:42  prisma.training.findMany({ where: { status: 'ACTIVE' } })
    Risk: cross-tenant veri sızması

🟡 MUAF (super-admin/PK lookup):
  - src/app/api/super-admin/.../route.ts:15
```

## Yaklaşım

- `Grep` ile aday satırları bul (`prisma\.\w+\.(findMany|findFirst|update|delete|count|aggregate|groupBy)`).
- Her aday için `Read` ile etrafını oku — `where` bloğunu incele.
- `requireRole(...,['super_admin'])` içeren route'ları muaf say.
- $ARGUMENTS verilmişse, sadece o klasörü/dosyayı tara.

Sonunda toplam bulgu sayısı ve düzeltme önerisi (örnek `where: { organizationId: profile.organizationId, ... }` ekleme) ile bitir.
