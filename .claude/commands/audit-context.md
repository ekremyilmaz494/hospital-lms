---
name: audit-context
description: Güvenlik denetimi öncesi derinlemesine mimari bağlam oluştur (Trail of Bits metodolojisi)
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Derin Bağlam Oluşturucu — Hospital LMS Güvenlik Denetimi

Trail of Bits'in "audit-context-building" metodolojisini bu projeye uygula.

## Ne Zaman Kullan

- Yeni bir modülü güvenlik açısından analiz etmeden önce
- API endpoint veya auth akışı incelemeden önce
- Potansiyel bir güvenlik açığını araştırmadan önce

## Ne Zaman Kullanma

- Hızlı bir syntax hatası veya UI düzeltmesi için
- Zaten tam bağlamın varsa

## Analiz Süreci

### Faz 1 — Minimum Harita

Şu soruları yanıtla:
1. **Modüller**: Bu kodun hangi modül/katmanda olduğunu belirle (`src/app/api/`, `src/hooks/`, `src/lib/`)
2. **Giriş Noktaları**: API route mu, hook mu, yardımcı fonksiyon mu?
3. **Aktörler**: Kim çağırıyor? (super_admin, admin, staff, anonim)
4. **Depolama**: DB (Prisma), Redis, sessionStorage, localStorage mı kullanılıyor?

### Faz 2 — Ultra-Granüler Fonksiyon Analizi

Her fonksiyon için şunları belgele:
- **Amaç**: Tek cümleyle ne yapıyor
- **Girdiler ve Varsayımlar**: Parametreler, beklenen tipler, gizli kısıtlamalar
- **Çıktılar ve Yan Etkiler**: Ne döndürüyor, DB/state'i nasıl değiştiriyor
- **Blok-blok mantık**: Her satırı/bloğu ayrı ayrı açıkla

Her fonksiyon için minimum:
- 3 invariant (değişmez kural)
- 5 assumption (varsayım)
- 3 risk değerlendirmesi

### Faz 3 — Global Sistem Anlayışı

- **State invariantları**: Hangi koşullar her zaman doğru olmalı?
- **Trust boundaries**: Hangi veriye güvenilir, hangisine güvenilmez?
- **Karmaşıklık kümeleri**: Hangi kod en savunmasız alanlar?

### Bu Proje için Kritik Kontrol Noktaları

**Multi-tenant izolasyon**: Her Prisma sorgusunda `organizationId` var mı?
```typescript
// DOĞRU:
prisma.training.findMany({ where: { organizationId: dbUser.organizationId } })
// YANLIŞ — tenant sızıntısı riski:
prisma.training.findMany({})
```

**Auth zincirleri**: `getAuthUser()` + `requireRole()` sırası doğru mu?

**Input validation**: Zod schema her API'de kullanılmış mı?

**Audit log**: Kritik işlemler (`suspend`, `delete`, `impersonate`) loglanıyor mu?

## Güvenlik Odaklı Soru Seti

Her analiz edilen kod için şunları sor:

1. Bu kodu kötü niyetli bir kullanıcı nasıl kötüye kullanabilir?
2. Başka bir organizasyonun verisine erişmek için nasıl kullanılabilir?
3. Rate limit olmadan ne olur?
4. Token/session manipülasyonu nasıl etki eder?
5. Race condition mümkün mü?

## Çıktı Formatı

```
## [Modül Adı] Bağlam Raporu

### Mimari Konum
[Hangi katmanda, hangi modül]

### Aktörler ve Trust Boundary
[Kim erişebilir, hangi doğrulama var]

### Kritik Fonksiyonlar
[Her fonksiyon için amaç + 3 invariant]

### Risk Değerlendirmesi
[Yüksek/Orta/Düşük + gerekçe]

### Kaçırılan Kontroller
[Eksik validasyon, auth, loglama]
```

---
*Trail of Bits "audit-context-building" v1.1.0 metodolojisi temel alınmıştır.*
