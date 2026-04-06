# Hospital LMS — Performans & Geliştirme Kuralları

> Bu belge, Supabase Frankfurt migration sürecinde karşılaşılan hatalardan ve çözümlerinden çıkarılan kuralları içerir.
> Her geliştirici bu kuralları okuyup uygulamalıdır.

---

## 1. Next.js Dev Mode vs Production

### Sorun
Next.js dev mode (webpack), her route'u ilk istek geldiğinde derler. Bu, sayfa başına 5-30 saniye gecikme yaratır. Production build'de aynı sayfalar 3-7ms'de açılır.

### Kurallar
- **Dev server yeniden başlatıldığında** tüm route cache'i sıfırlanır — ilk açılışlar yavaş olacaktır, bu normaldir
- **Performans testi her zaman production build'de yapılır:** `pnpm build --webpack && pnpm start`
- Dev mode'da yavaşlık gördüğünde önce `pnpm build` ile production'da test et — sorun devam ediyorsa o zaman koda bak
- `@ducanh2912/next-pwa` kullanan projelerde build komutu `next build --webpack` olmalıdır (Turbopack PWA desteklemez)

---

## 2. Supabase Bağlantı Kuralları

### Pooler Hostname
- Supabase pooler hostname'i bölgeye göre değişir (`aws-0`, `aws-1`, `aws-2`)
- **Asla hostname'i tahmin etme** — Dashboard > Project Settings > Database > Connection string'den kopyala
- Frankfurt bölgesi: `aws-1-eu-central-1.pooler.supabase.com` (aws-0 DEĞİL)

### Port Kullanımı
| Port | Mod | Kullanım | Prisma Migration |
|------|-----|----------|-----------------|
| 6543 | Transaction (pgbouncer) | Uygulama sorguları | HAYIR — DDL çalışmaz |
| 5432 | Session | Migration, DDL | EVET — ama free tier'da IPv4 gerektirir |

- **Prisma migration** (DDL işlemleri) pooler üzerinden çalışmaz — `FATAL: Tenant or user not found` veya prepared statement hataları alırsın
- Free tier'da direct connection (port 5432) IPv4 gerektirdiğinden, migration'ları **Supabase MCP `apply_migration` tool'u** ile uygula
- `prisma.config.ts`'de `directUrl` tanımlı olsa bile, free tier'da direct port erişilemeyebilir

### Prepared Statement Sorunu
- Supabase Supavisor (pgbouncer) transaction mode'da prepared statement'ları bağlantılar arası paylaşamaz
- **PrismaPg adapter'a `pg.Pool` instance geçir**, `connectionString` değil:
```typescript
import { Pool } from 'pg'
const pool = new Pool({ connectionString, max: 10, min: 2 })
const adapter = new PrismaPg(pool as any)
```
- `connectionString` ile geçirirsen `"prepared statement s1 already exists"` hatası alırsın

### MCP ile Migration
- Supabase MCP `execute_sql` ve `apply_migration` tool'ları Management API üzerinden çalışır — pooler/direct bağlantı sorunlarından etkilenmez
- Yeni proje oluşturulduğunda DB şifresi otomatik atanır ve döndürülmez — Dashboard'dan manuel sıfırla
- MCP ile proje oluşturma `confirm_cost` adımı gerektirir

---

## 3. UUID Kuralları

### Zod v4 Strict UUID Validation
- Zod v4'ün `.uuid()` validatörü **RFC 4122** uyumluluğunu kontrol eder
- Version bit (13. karakter): 1-5 olmalı
- Variant bit (17. karakter): 8, 9, a, b olmalı
- `a0000000-0000-0000-0000-000000000001` gibi "fake" UUID'ler **REDDEDİLİR**

### Kurallar
- Seed verilerinde her zaman `gen_random_uuid()` (PostgreSQL) veya `crypto.randomUUID()` (Node.js) kullan
- Asla elle UUID oluşturma (`a0000000...`, `b0000000...` gibi)
- Zod UUID hata mesajlarını Türkçeleştir:
```typescript
z.string().uuid({ message: 'Geçersiz kimlik formatı' })
```
- API error mapping'de UUID hatalarını yakala — ham "Invalid uuid" mesajı kullanıcıya gösterme

---

## 4. Prisma & Veritabanı Kuralları

### Bağlantı Havuzu (Pool)
```typescript
const pool = new Pool({
  connectionString,
  max: 10,        // Maks eşzamanlı bağlantı
  min: 2,         // Minimum sıcak bağlantı (idle kalır)
  idleTimeoutMillis: 60000,      // 60s boşta kalırsa kapat
  connectionTimeoutMillis: 15000, // 15s bağlantı timeout
  allowExitOnIdle: false,        // Process'in pool yüzünden kapanmasını engelle
})
// İlk bağlantıyı hemen kur (warm start)
pool.connect().then(c => c.release()).catch(() => {})
```

### Select vs Include
- `include` tüm kolonları getirir — gereksiz veri transferi
- **Response'da kullanılan alanlar belliyse `select` kullan:**
```typescript
// KÖTÜ — tüm training kolonları gelir
training: { include: { _count: { select: { questions: true } } } }

// İYİ — sadece ihtiyaç duyulan alanlar
training: { select: { title: true, category: true, _count: { select: { questions: true } } } }
```

### Sıralı Sorgular Yasak
- API route'larda döngü içinde `await prisma...` **YASAK**
- Tüm bağımsız sorgular `Promise.all` ile paralel çalıştırılmalı:
```typescript
// KÖTÜ
const users = await prisma.user.findMany(...)
const trainings = await prisma.training.findMany(...)

// İYİ
const [users, trainings] = await Promise.all([
  prisma.user.findMany(...),
  prisma.training.findMany(...),
])
```

### Schema Değişikliği Sonrası
1. `pnpm db:generate` — Prisma client'ı yeniden oluştur
2. Migration oluştur veya `db push` yap
3. Dev server'ı yeniden başlat (eski Prisma client cache'lenir)

---

## 5. Harici Servis Çağrıları (S3, Redis)

### S3 URL Üretimi — Waterfall Önleme
```typescript
// KÖTÜ — her video için sıralı S3 call
videos: await Promise.all(videos.map(async v => ({
  url: await getStreamUrl(v.videoKey),  // Her biri ~100ms
})))

// İYİ — önce toplu üret, sonra eşle
const streamUrls = await Promise.all(
  videos.map(v => v.videoKey ? getStreamUrl(v.videoKey) : Promise.resolve(null))
)
videos: videos.map((v, i) => ({ url: streamUrls[i] ?? v.videoUrl }))
```

### Redis Pipeline
- Birden fazla Redis komutu varsa `pipeline()` kullan — tek HTTP round-trip:
```typescript
// KÖTÜ — 2 ayrı HTTP call (~800ms)
await redis.set(key, 0, { nx: true, ex: ttl })
const current = await redis.incr(key)

// İYİ — tek HTTP call (~400ms)
const pipeline = redis.pipeline()
pipeline.set(key, 0, { nx: true, ex: ttl })
pipeline.incr(key)
const results = await pipeline.exec()
const current = results[1] as number
```

### Redis Client
- `keepAlive: true` ile HTTP bağlantısını yeniden kullan
- Upstash Redis HTTP-tabanlıdır — her `await redis.xxx()` ayrı HTTP isteğidir

---

## 6. Frontend Performans Kuralları

### React.memo & useMemo
- Sık render olan büyük component'ları `React.memo` ile sar
- `data` ve `columns` gibi referans değişen prop'ları `useMemo` ile stabilize et
- `useReactTable` gibi hook'ları `useMemo` içine **ALMA** — hook kurallarını bozar

### Dynamic Import Dedup
- Aynı modülden birden fazla named export yükleniyorsa, shared import function kullan:
```typescript
// KÖTÜ — webpack 3 ayrı chunk oluşturur
const A = dynamic(() => import('./charts').then(m => ({ default: m.A })))
const B = dynamic(() => import('./charts').then(m => ({ default: m.B })))

// İYİ — webpack tek chunk oluşturur
const chartImport = () => import('./charts')
const A = dynamic(() => chartImport().then(m => ({ default: m.A })))
const B = dynamic(() => chartImport().then(m => ({ default: m.B })))
```

### Cache-Control Headers
- Sık değişmeyen dashboard verileri için browser cache kullan:
```typescript
return jsonResponse(data, 200, {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=60'
})
```
- `private` — sadece tarayıcı cache'ler, CDN cache'lemez
- `max-age=300` — 5 dakika fresh
- `stale-while-revalidate=60` — 5 dk sonra eski veriyi gösterip arka planda yenile

---

## 7. Date Parse Optimizasyonu

```typescript
// KÖTÜ — döngüde her iterasyonda yeniden parse (N×M)
for (const month of months) {
  const filtered = items.filter(a => {
    const d = new Date(a.createdAt)  // Her seferinde yeni Date
    return d >= start && d < end
  })
}

// İYİ — bir kez parse et, sonra filtrele (N+M)
const itemsWithDates = items.map(a => ({ ...a, date: new Date(a.createdAt) }))
for (const month of months) {
  const filtered = itemsWithDates.filter(a => a.date >= start && a.date < end)
}
```

---

## 8. Hata Mesajı Kuralları

### Zod Validation Hataları
- Her API route'da Zod hata mesajlarını alan bazlı Türkçeleştir
- Ham Zod mesajları (örn. "Invalid uuid", "String must contain at least 1 character") kullanıcıya gösterme
- Debug log'a tam hata detayını yaz:
```typescript
if (!parsed.success) {
  logger.error('Context', 'Validation failed', parsed.error.issues)
  const msg = parsed.error.issues.map(i => {
    const field = i.path.join('.')
    if (field === 'email') return 'Geçerli bir e-posta adresi girin'
    if (field === 'departmentId') return 'Geçersiz departman seçimi'
    // ... diğer alanlar
    return i.message
  }).join(', ')
  return errorResponse(msg)
}
```

### DB Hataları
- Prisma/PostgreSQL hata detaylarını (tablo adı, kolon bilgisi) kullanıcıya **ASLA** gösterme
- Güvenli Türkçe mesaj döndür + `logger.error()` ile sunucu loguna yaz

---

## 9. Migration Sonrası Kontrol Listesi

Yeni bir Supabase projesi oluşturulduğunda veya migration yapıldığında:

- [ ] Dashboard'dan doğru pooler hostname'ini kopyala
- [ ] DB şifresini Dashboard'dan sıfırla (MCP otomatik şifre döndürmez)
- [ ] Tüm tabloları oluştur (Prisma migration veya MCP apply_migration)
- [ ] RLS politikalarını uygula (sadece mevcut tablolar için)
- [ ] Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`
- [ ] Seed verilerinde `gen_random_uuid()` kullan (fake UUID kullanma)
- [ ] Auth user_metadata'ya `organization_id` ekle
- [ ] Tarayıcı cookie'lerini temizle (eski JWT geçersiz)
- [ ] `pnpm db:generate` ile Prisma client'ı yenile
- [ ] `pnpm build --webpack && pnpm start` ile production test yap

---

## 10. TypeScript Duplicate Types Sorunu

- `@types/pg` paketinin birden fazla versiyonu pnpm'de nested olabilir
- `Pool` tipi uyumsuzluğu `as any` cast ile çözülür:
```typescript
const adapter = new PrismaPg(pool as any)
```
- Bu bilinen bir pnpm hoisting sorunudur, kalıcı çözüm: `pnpm dedupe`

---

*Son güncelleme: 2026-04-06 — Frankfurt Migration*
