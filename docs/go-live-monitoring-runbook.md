# Go-Live İzleme Runbook'u

> Hospital LMS — Canlıya çıkış sonrası ilk 24 saat + sürekli izleme planı
> Oluşturulma: 2026-04-23

Bu runbook **Go-Live Kontrol Listesi G bölümü** (İzleme) için operasyonel detayları içerir.

---

## 1. Health Check

### Endpoint
`GET /api/health` — public, auth gerektirmez.

### Beklenen davranış
- **200 OK** + JSON `{ status: 'ok', db: 'ok', redis: 'ok', timestamp: ISO }`
- Yanıt süresi < 500ms
- DB ve Redis alt kontrolleri başarısız ise ilgili alan `'degraded'` döner, status code yine 200 kalır (liveness vs readiness ayrımı)

### Uptime izleme
- **Araç**: UptimeRobot / Better Uptime / Vercel Analytics
- **Ping sıklığı**: 1 dakika
- **Alarm eşiği**: 3 ardışık fail → Slack + email
- **SLA hedefi**: %99.5 (ilk 30 gün), %99.9 (stabilize sonrası)

---

## 2. Cron Jobs

Konfigürasyon: `vercel.json`

| Cron | Saat (UTC) | Amaç | Başarısızlık etkisi |
|------|-----------|------|---------------------|
| `/api/cron/backup` | 03:15 | DB yedekleme → S3 | Yüksek (RPO ihlali) |
| `/api/cron/cleanup` | 03:00 | Stale attempt, notif, audit rotation | Düşük (1-2 gün tolerans) |
| `/api/cron/verify-backup` | 03:45 | Yedek geri okunabilirlik kontrolü | Yüksek (sessiz korupt yedek) |

### Başarısızlık bildirimi
- **Sentry**: Her cron route `withPerfLogging` + `try/catch` + `logger.error` sarılı → Sentry alarma düşer
- **Email fallback**: `ADMIN_ALERT_EMAIL` env var'ına gönderim (cron route kendi içinden)
- **Eşik**: Aynı cron 2 ardışık fail → P1 incident (ops çağrılır)

### Manuel tetik
Gerektiğinde Vercel dashboard → Cron Jobs → "Run now". Sonucu her zaman `vercel logs --follow` ile izle.

---

## 3. Backup Verify

### Otomatik akış
1. `03:15` → backup oluştur + S3'e yükle + AES-256-GCM ile şifrele (`BACKUP_ENCRYPTION_KEY`)
2. `03:45` → verify-backup: S3'ten indir → decrypt → JSON parse → yapı kontrolü (`isValidBackupData`)
3. Başarısızlık → Sentry + email alert

### Manuel doğrulama (haftada 1)
```bash
# Vercel prod ortamında
pnpm verify:backup --latest
```
- Beklenen: `✅ Latest backup verified (X records)` + exit 0
- Başarısızsa: BACKUP_ENCRYPTION_KEY rotation veya S3 permission sorunu olabilir

### Kritik guard (2026-04-23 eklendi)
`src/lib/backup-crypto.ts`: `NODE_ENV=production` ortamında `BACKUP_ENCRYPTION_KEY` eksikse `throw`. Plaintext yedek yazılması sessiz değil, artık fail-loud.

---

## 4. Rate Limit & Exam Timer — Redis Sağlığı

### Risk
`src/lib/redis.ts` Redis down senaryosunda **process-local memory fallback**'e iner. Vercel multi-instance'ta bu, rate limit ve exam timer'ın instance'lar arası divergence yapması demektir.

### Alarm
`warnFallback()` helper (2026-04-23 eklendi) production'da memory fallback her kullanımında `logger.error('Redis', ...)` atar → Sentry event.

### Tepki
- **1 tekil fallback**: normal (network glitch) — dokunma
- **5 dakika içinde 50+ fallback**: Upstash down olasılığı → dashboard kontrol + ops çağır
- **100+ fallback**: P0 incident — exam integrity riski, ilgili sınavları invalidate et

### Upstash dashboard
`console.upstash.com` → Redis → hospital-lms-prod → Metrics (latency, error rate)

---

## 5. Sentry

### DSN
- Client: `NEXT_PUBLIC_SENTRY_DSN`
- Server + edge: `SENTRY_DSN`

### Önemli alarm kuralları
1. **Error rate**: 5 dk'da %1'den fazla 500 response → Slack
2. **Redis fallback events** (`scope=startExamTimer|checkRateLimit`): 5 dk'da 50+ → email
3. **Backup decrypt failed**: 1 bile → ops'a direkt çağrı
4. **OIDC token verify failed** (`sso:callback`): 10 dk'da 5+ → güvenlik ekibi

### Source maps
Build sırasında `withSentryConfig` otomatik upload ediyor. `SENTRY_AUTH_TOKEN` revoke olduysa build fail eder — yenile.

---

## 6. Performance Budget

| Metrik | Hedef | Alarm eşiği |
|--------|-------|-------------|
| API p95 yanıt süresi | < 500ms | > 1s |
| DB query p95 | < 100ms | > 500ms |
| Dashboard load (Lighthouse) | > 80 | < 60 |
| Bundle size (main) | < 500kB gz | > 700kB gz |

İzleme: Vercel Analytics + Speed Insights. Haftalık review.

---

## 7. İlk 24 Saat Sorumluluk Matrisi (Template)

| Zaman dilimi (TR) | Birincil | Yedek | Odak |
|-------------------|----------|-------|------|
| 09:00 – 13:00 | Ekrem | [yedek-1] | Deploy + smoke test + ilk kullanıcı giriş |
| 13:00 – 18:00 | [ops-1] | Ekrem | İstek akışı, rate limit, sınav başlatma |
| 18:00 – 00:00 | [ops-2] | [ops-1] | Cron (03:00/03:15/03:45) öncesi hazır |
| 00:00 – 09:00 | Ekrem (on-call) | — | Backup + cleanup + verify tamamlanma |

**İletişim kanalları**:
- P0 (veri kaybı, tüm sistem down): Telefon + Slack #incidents
- P1 (kısmi, kritik feature): Slack #ops
- P2 (tek kullanıcı, görsel bug): Jira/Linear ticket

### Rollback prosedürü
1. Vercel dashboard → Deployments → önceki başarılı deployment → "Promote to Production"
2. Eğer DB migration geri alınması gerekiyorsa: `prisma/migrations/` altındaki down SQL manuel çalıştır (Supabase SQL Editor)
3. Tüm kullanıcıları bilgilendir — statü sayfası veya email

---

## 8. Bilinen açık kararlar (post-launch çözülecek)

### B12 — Terms acceptance (dead wire)
- **Durum**: `/api/auth/accept-terms` endpoint + `TermsModal` component + `termsAccepted` DB kolonu mevcut, **hiç mount edilmiyor/kontrol edilmiyor**.
- **Neden go-live blocker değil**: KVKK (legal requirement) `kvkk_notice_acknowledged_at` üzerinden middleware'de zaten zorunlu. Genel ToS ayrı enforcement Türkiye KVKK için legally required değil.
- **Karar gerekli**: (a) Wire up (AuthProvider + JWT metadata sync) veya (b) remove (schema migration + endpoint + component sil). Ayrı odaklı PR + QA.

### B14 — Reporting "locked" status
- **Yapıldı** (2026-04-23): `locked` artık `failedCount`'a dahil. Ayrı `lockedCount` metriği ileride UI'a eklenebilir.

---

## 9. Post-launch haftalık review (ilk 4 hafta)

Pazartesi 10:00'da 30 dk sync:
1. Sentry error trend (geçen haftaya göre artış?)
2. Cron başarı oranı (3 cron × 7 gün = 21 run, % başarı)
3. Backup verify pass rate
4. Redis fallback event count
5. Yeni kullanıcı akışı kırılan yer var mı?
6. Performance budget ihlali oldu mu?

Sonuç: Next week's P1 list → Linear.
