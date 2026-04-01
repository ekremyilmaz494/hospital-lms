---
name: sharp-edges
description: Tehlikeli API kullanımları, güvensiz varsayılanlar ve hata-prone pattern'leri tespit et (Trail of Bits metodolojisi)
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Sharp Edges Analizi — Hospital LMS

Trail of Bits'in "sharp-edges" metodolojisini bu projeye uygula.
**Temel ilke**: "Güvenli kullanım en az dirençli yol olmalıdır."

## Ne Zaman Kullan

- Yeni bir kütüphane veya API entegre edildiğinde
- Supabase, Prisma, JWT veya Redis ile ilgili kod yazılırken
- "Bu nasıl yanlış gidebilir?" sorusu sorulduğunda

## Bu Proje için Bilinen Sharp Edge Kategorileri

### 1. Supabase RLS Bypass Riski

```typescript
// ⚠️ DANGER: service_role ile yapılan sorgular RLS'i BYPASS eder
const adminClient = createServiceClient() // service_role key kullanır
await adminClient.from('users').select('*') // TÜM kullanıcılar — RLS yok!

// ✅ SAFE: Normal client RLS'e tabidir
const client = createClient() // anon/user key
await client.from('users').select('*') // Sadece kendi kaydı
```

**Kontrol**: `createServiceClient()` nerede kullanılıyor?
```bash
grep -r "createServiceClient" src/ --include="*.ts"
```

### 2. Prisma organizationId Eksikliği

```typescript
// ⚠️ DANGER: Tenant sızıntısı — başka hastane verisini görebilir
const trainings = await prisma.training.findMany()

// ✅ SAFE: Her zaman organizationId filtresi
const trainings = await prisma.training.findMany({
  where: { organizationId: dbUser.organizationId }
})
```

**Kontrol**: organizationId filtresi olmayan sorgular:
```bash
grep -n "findMany\|findFirst\|findUnique" src/app/api/ -r | grep -v "organizationId\|where: { id"
```

### 3. Redis fail-closed → Login Bloklama

```typescript
// ⚠️ DANGER (eski davranış): Redis hata verince login tamamen bloklanır
} catch {
  return false // Her login denemesini reddeder!
}

// ✅ SAFE (mevcut): In-memory fallback'e geç
} catch {
  resetRedis()
  // in-memory fallback devreye girer
}
```

### 4. Magic Link Scope Sızıntısı (G3.4)

```typescript
// ⚠️ DANGER: super_admin'i impersonate etmeye izin verme
if (targetUser.role === 'super_admin') return errorResponse('Forbidden', 403)
```

**Kontrol**: Impersonation endpoint'i doğru korumalı mı?
```bash
grep -n "impersonate\|super_admin" src/app/api/super-admin/impersonate/route.ts
```

### 5. sessionStorage Cross-Tab Sızıntısı

```typescript
// ⚠️ RISK: sessionStorage farklı sekmeler arasında paylaşılmaz ama
// aynı sekmedeki SPA navigasyonunda kalır
sessionStorage.setItem('exam-results-${id}', JSON.stringify(results))
// Sonraki sayfada temizlenmeli!
sessionStorage.removeItem(`exam-results-${id}`)
```

### 6. Stringly-Typed Roller

```typescript
// ⚠️ DANGER: String karşılaştırması typo'ya açık
if (user.role == 'superadmin') // 'super_admin' değil!

// ✅ SAFE: requireRole helper kullan
requireRole(dbUser.role, ['super_admin'])
```

### 7. Exam Timer — Redis Süresiz Bekleme

```typescript
// ⚠️ RISK: Redis'e erişilemezse sınav zamanlaması in-memory'ye düşer
// Server restart durumunda timer kaybolur → sınav süresi sıfırlanır
// Kritik sınavlar için bu kabul edilebilir mi?
```

## Analiz Metodolojisi

### Adım 1 — Güvenlik-Kritik API'leri Tespit Et

```bash
# Auth ile ilgili tüm kullanımlar
grep -rn "createClient\|createServiceClient\|getAuthUser\|signIn\|signOut" src/ --include="*.ts" --include="*.tsx"

# Prisma write işlemleri
grep -rn "create\|update\|delete\|upsert" src/app/api/ --include="*.ts" | grep "prisma\."
```

### Adım 2 — Edge Case Probe

Her güvenlik-kritik fonksiyon için şunu sor:
- `null` veya `undefined` girerse ne olur?
- Boş string (`""`) girerse ne olur?
- Negatif sayı girerse ne olur?
- Çok büyük girdi (DoS) girerse ne olur?

### Adım 3 — Üç Perspektiften Threat Model

1. **Kötü niyetli**: Kasıtlı olarak sistemi kötüye kullanmaya çalışıyor
2. **Dikkatsiz**: Yanlış veri gönderiyor, hataları görmezden geliyor
3. **Kafası karışık**: API'yi yanlış anlıyor, yanlış parametre sırası kullanıyor

### Adım 4 — Bulguları Doğrula

Her bulgu için:
- Somut exploit senaryosu yaz
- Reproduksiyon adımlarını belgele
- Severity belirle: **Critical / High / Medium / Low**

## Severity Kriterleri

| Severity | Kritik | Örnek |
|----------|--------|-------|
| **Critical** | Varsayılan davranış güvensiz | `organizationId` filtresi eksik |
| **High** | Kolay exploit edilebilir | Redis down → login blok |
| **Medium** | Belirli koşullarda exploit | Session ID tahmin edilebilir |
| **Low** | Kasıtlı bypass gerektirir | Debug endpoint production'da açık |

---
*Trail of Bits "sharp-edges" metodolojisi temel alınmıştır.*
