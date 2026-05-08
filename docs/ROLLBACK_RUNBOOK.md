# Rollback Runbook — Hospital LMS

> Son güncelleme: 2026-05-08
> Hedef kitle: tek operatör + ileride katılacak ekip
> İlişkili dokümanlar: [disaster-recovery.md](./disaster-recovery.md), [STAGING_SETUP.md](./STAGING_SETUP.md)

## Bu doküman ne içindir?

Müşteri canlıdayken **bir şey kırıldığında** hızlı, doğru, geri dönülebilir aksiyon almak için. Disaster-recovery doc'u "DB öldü, S3 kayıp" gibi büyük felaketleri kapsıyor; bu runbook **gündelik küçük-orta felaketleri** kapsar: bozuk deploy, kötü migration, yanlış güncellenmiş veri.

**Kullanım:** Sorun çıktığı anda doğru senaryoya atla, adımları sırayla uygula. Tahmin etme, doğrula.

---

## Karar Ağacı — Hangi Senaryo?

```
Sorun nedir?
│
├── UI bozuk / API 500 / sayfa açılmıyor / yanlış davranış
│   └── → SENARYO A: Kod Rollback (Vercel)
│
├── Migration sonrası DB hatası / kolon kayıp / FK kırık
│   └── → SENARYO B: Migration Rollback
│
├── Veri yanlış güncellendi / silindi / bozuldu
│   ├── Kayıp veri 24 saatten az → SENARYO C: Backup Restore
│   └── Kayıp veri 24 saatten çok → SENARYO D: Cerrahi Restore (org bazında)
│
├── Sistem tamamen çöktü (DB, S3, Vercel hep down)
│   └── → docs/disaster-recovery.md → Senaryo 1-3
│
└── Karar veremiyorum / panik
    └── → ACIL PROTOKOL (en aşağıda)
```

---

## ÖNKOŞULLAR — Bu Bilgiler Eline Hazır Olsun

Sorun anında dakikalar değerli. Bu listenin **kaydedilmiş ve erişilebilir** olduğunu Faz 0'da doğrula:

- [ ] Vercel Dashboard linki + 2FA aktif: https://vercel.com/ekremyilmaz494s-projects
- [ ] Supabase Dashboard linki + 2FA aktif: https://supabase.com/dashboard
- [ ] AWS Console + IAM credentials güvenli depo (1Password vb.)
- [ ] `BACKUP_ENCRYPTION_KEY` + `BACKUP_ENCRYPTION_KEY_OLD` güvenli yedek
- [ ] `HEALTH_CHECK_SECRET` (acil health check için)
- [ ] Müşteri yöneticisi telefon + e-posta
- [ ] Bu repo lokal makinede güncel (`git pull` 24 saatten yeni)

---

## SENARYO A: Kod Rollback (Vercel)

**Ne zaman?** UI bozuk, API 500 dönüyor, yeni feature kötü davranıyor, yanlış koda deploy edildi.

**Süre hedefi:** 5 dakika içinde rollback tamamlanmış olsun.

### Adımlar

```
1. TESPİT (0:00–0:30)
   - https://[prod-url]/api/health (HEALTH_CHECK_SECRET ile)
   - Sentry son 5dk: hangi hata patlamış?
   - Vercel Dashboard → Deployments → en üstteki deploy "Production" işaretli mi?

2. KARAR (0:30–1:00)
   - Bu hata son deploy'dan mı geliyor? (Sentry timestamp + Vercel deploy timestamp karşılaştır)
   - EVET → rollback yap (devam)
   - HAYIR → Senaryo B veya C'ye git

3. ROLLBACK (1:00–3:00)
   - Vercel Dashboard → Deployments
   - Şu anki Production'dan ÖNCE Ready statüsündeki deploy'u bul
   - ⋯ menü → "Promote to Production"
   - Onay diyaloğu: "Promote"
   - ~30 saniyede yayına çıkar

4. DOĞRULAMA (3:00–5:00)
   - https://[prod-url]/api/health → status: healthy
   - Sentry: yeni hata akışı durdu mu?
   - Tarayıcıda kritik akışları test et: login + dashboard + bir sınav
   - Müşteriden "şimdi nasıl?" teyidi al
```

### Müşteri Bildirimi (P0 ise)

```
[Hospital LMS] Geçici Hizmet Sorunu — Çözüldü

Sayın [Müşteri Adı],

Bugün saat HH:MM ile HH:MM arasında sistemde [kısa belirti] yaşandı.
Sorun YY:YY itibariyle giderildi. Veri kaybı bulunmamaktadır.

Detaylı post-mortem raporunu 24 saat içinde paylaşacağım.

Saygılarımla,
[Adın]
```

### Sonra

- [ ] Bozan PR'ı işaretle ("revert" veya "fix-forward" branch'i)
- [ ] `docs/incidents/YYYY-MM-DD-<isim>.md` post-mortem yaz
- [ ] CI'da yakalanmayı sağlayacak test ekle

---

## SENARYO B: Migration Rollback

**Ne zaman?** Yeni migration deploy edildi, sonra DB hataları başladı (kolon yok, FK kırık, unique constraint patladı).

**Süre hedefi:** 30 dakika (migration karmaşıklığına göre).

### ⚠️ KRİTİK UYARI

> **Prisma `migrate down` YOKTUR.** Migration'ı geri almak için **YENİ bir reverse migration** yazmak zorundasın. Eski migration dosyasını silmek HİÇBİR ŞEYİ geri almaz.

### Adımlar

```
1. TESPİT (0:00–2:00)
   - Sentry → DB hataları (Prisma error, column not found, vs)
   - Vercel deploy log → migration:on:prod adımı geçmiş mi?
   - prisma/migrations/ → en son klasör hangisi?

2. KARAR (2:00–5:00)
   - Migration'ın etkisi: sadece şema mı, yoksa veri mi değişti?
   - Sadece şema → kolon ekleme/kaldırma → reverse migration kolay
   - Veri değişti (UPDATE/INSERT) → Senaryo C'ye git (backup restore daha güvenli)

3. REVERSE MIGRATION YAZ (5:00–15:00)
   Lokalde:
   - schema.prisma'yı önceki haline ÇEVİR (git history yardımcı)
   - pnpm db:migrate dev --name revert_<orijinal-isim>
   - Üretilen SQL'i AÇıP OKU — gerçekten ters mi alıyor?
   - Test: Lokalde DB'yi son migration'a getir, sonra reverse'ü uygula, hata var mı?

4. STAGING'DE DOĞRULA (15:00–25:00)
   - Branch'ı staging'e push
   - Vercel staging deployment otomatik açılır
   - migrate:on:prod çalışmış olmalı (build log'tan teyit)
   - Staging UI'da etkilenen akışları test et

5. PROD'A DEPLOY (25:00–30:00)
   - SADECE müşteri saatleri DIŞINDA (akşam 22:00 sonrası tercih)
   - Acil ise: müşteriye SMS/e-posta haber ver, kısa bakım penceresi aç
   - main branch'e merge → migrate:on:prod otomatik çalışır
   - Sentry'i izle

6. VERİ KAYBI?
   - Reverse migration kolon kaldırıyorsa → o kolondaki veri SİLİNİR
   - Eğer veri korunması gerekiyorsa: önce o veriyi başka tabloya/JSON'a yedekle
```

### 2-Aşamalı Migration Disiplini (gelecek için)

DROP COLUMN'u tek migration'da yapma — bu zaten CLAUDE.md'de yazılı ama tekrar:

```
Aşama 1 (deploy şimdi):
- Eski kolonu DEPRECATED işaretle (kod artık YAZMAZ)
- Yeni kolonu ekle, kodu yeni kolona yönlendir
- Eski kolon hâlâ DB'de duruyor (read-only)

Aşama 2 (1-2 hafta sonra, sorun çıkmadığı doğrulandıktan):
- Eski kolonu DROP et
```

Bu disiplin sayesinde Senaryo B'ye düşme olasılığı çok azalır.

---

## SENARYO C: Backup Restore (Veri Kaybı / Bozulma)

**Ne zaman?** Veri yanlış UPDATE edildi, bir org'un kayıtları silindi/karıştı, son 24 saat içinde geri alınması gereken durum.

**Süre hedefi:** 1-2 saat (org boyutuna göre).

### 3 Restore Yöntemi — Ne Zaman Hangisi?

| Yöntem | Ne zaman | Önkoşul | Risk |
|--------|----------|---------|------|
| **Restore Drill** ([scripts/restore-drill.js](../scripts/restore-drill.js)) | Önce her zaman dry-run | Lokal makine + DATABASE_URL + AWS creds | DB'ye yazmaz, %0 risk |
| **Restore API** ([/api/super-admin/restore](../src/app/api/super-admin/restore/route.ts)) | Sistem AYAKTA, super_admin giriş yapabiliyor | Web/API erişilebilir | Tx içinde, audit log var |
| **Standalone CLI** (`scripts/restore-from-backup.ts` — yazılacak) | Web/API DOWN, doğrudan DB'ye yazmak gerek | DATABASE_URL + AWS creds | Yüksek — UI olmadığı için yanılma riski |

### Standart Akış (Restore API ile)

```
1. TESPİT + KARAR (0:00–10:00)
   - Hangi org etkilendi? (admin panel veya audit log)
   - Hangi tarihten önceki veriye dönmek lazım?
   - db_backups tablosunda o tarih için verified=true backup var mı?
     SELECT id, organization_id, created_at, file_size_mb, verified
     FROM db_backups
     WHERE organization_id = '<org-id>'
       AND status = 'completed' AND verified = true
     ORDER BY created_at DESC LIMIT 5;

2. DRILL (10:00–15:00) — DRY RUN
   node scripts/restore-drill.js --backup-id=<uuid>
   Beklenen çıktı: ✅ DRILL BAŞARILI — toplam Xms
   Eğer başarısızsa: backup bozuk, daha eskisini dene

3. STAGING'DE DENE (15:00–35:00)
   - Önce staging'e restore et (Restore API ile)
   - Staging'deki mevcut veri SİLİNİR — staging'in zaten tek bir test org'u olduğunu doğrula
   - Restore sonrası UI test: kayıt sayıları, son işlemler, sertifikalar

4. MÜŞTERİYE BİLDİR (35:00–40:00)
   "Bilgilendirme: HH:MM tarihinde tespit edilen veri sorununu giderebilmek için
    YY:YY ile ZZ:ZZ arasında ZZ-YY tarihindeki yedek geri yüklenecek.
    Bu süre arasındaki [tahmini X kayıt] etkilenecek; sonrasında elinizdeki
    güncel verileri tekrar girmeniz gerekecek. Onayınızı bekliyoruz."
   ⚠️ MÜŞTERI ONAYI ALMADAN PROD'A RESTORE ÇEKME

5. PROD'A RESTORE (40:00–90:00)
   - super_admin olarak giriş yap
   - /super-admin/restore (UI varsa) veya doğrudan API çağır:
     POST /api/super-admin/restore { backupId, confirm: false }  → preview
     Görünen kayıt sayılarını kontrol et
     POST /api/super-admin/restore { backupId, confirm: true }   → execute
   - Endpoint maxDuration: 300s, transaction timeout: 120s

6. DOĞRULAMA (90:00–120:00)
   - Restore sonrası org dashboard'unu aç
   - Kayıt sayıları backup metadata ile aynı mı?
   - Son 5 audit log uygun mu?
   - Müşteri yöneticisinden "evet, doğru" teyidi
```

### Müşteri Veri Kaybı Şablonu

```
[Hospital LMS] Veri Geri Yükleme — Bilgilendirme

Sayın [Müşteri Adı],

[Tarih saat] tespit edilen [problem tanımı] sebebiyle, hızlı bir aksiyon olarak
[Tarih saat]'teki son güvenilir yedeği geri yükledik.

Etki:
- Geri yüklenen veri tarihi: <YYYY-MM-DD HH:MM>
- Bu tarihten sonra sisteme girilen veriler kaybolmuştur
- Etkilenen kayıt türleri: [eğitim atamaları / sınav cevapları / sertifikalar]
- Etkilenen yaklaşık kullanıcı sayısı: [N]

Yapmanız gereken:
- Bu tarihten sonra sisteme girdiğiniz [...] verileri tekrar girmeniz gerekiyor
- Sertifika almış olan personel için yeniden sınav ataması yapmanız gerekebilir

Detaylı rapor 48 saat içinde paylaşılacak.

Yaşadığınız sıkıntı için özür dileriz.
```

---

## SENARYO D: Cerrahi Restore (Tek Org, Eski Tarih)

**Ne zaman?** Veri kaybı 24 saatten eski (örn. 1 hafta önce yapılan yanlış toplu işlem fark edildi).

**Süre hedefi:** 2-4 saat (manuel kontrol gerekli).

### Yaklaşım

Tüm DB'yi geri yüklemek yerine, sadece etkilenen org'un eski yedeğini SEÇİCİ olarak restore et:

```
1. Etkilenen org için eski backup'ı bul (1 hafta öncesi)
2. Drill ile decrypt edip JSON'u al
3. Etkilenen TABLOLARI manuel seç (örn. sadece training_assignments)
4. Diğer tabloların güncel verisini koru
5. Karşılaştırma raporu çıkar (eski vs şimdiki, hangi kayıtlar farklı?)
6. Müşteriyle hangi kayıtların geri alınacağına KARAR ver
7. Manuel SQL veya geçici script ile sadece o kayıtları yaz
8. Audit log: hangi kayıt, kim tarafından, hangi tarihten geri alındı
```

⚠️ Bu senaryo **manuel SQL gerektirir**. ASLA panik halinde tek başına yapma; mutlaka:
- Müşteri onayı
- Staging'de prova
- Tek transaction içinde
- Geri alma planı (yazdığın SQL'in tersi)

---

## ACIL PROTOKOL — Kararsızsan, Donmuşsan

**3 dakika kuralı:** Kararsız kaldıysan, **bekle**. Acele kararla yanlış aksiyon almaktansa 3 dakika düşünmek daha güvenli.

```
00:00 — Telefon: "sistem çalışmıyor"

00:01 — DURUM ALMA
  - https://[prod-url]/api/health (header'lı detaylı)
  - Vercel Status: https://www.vercel-status.com
  - Supabase Status: https://status.supabase.com
  - Upstash Status: https://status.upstash.com

00:03 — KAYNAK BELİRLEME
  - Vercel/Supabase genel arıza mı? → bekle, müşteriyi bilgilendir
  - Bizim koddan mı? → Sentry son 10dk
  - DB'den mi? → Supabase logs
  - S3'ten mi? → AWS CloudWatch

00:05 — KARAR ZAMANI
  - Geri alabilir miyim? (rollback) → Senaryo A
  - Düzeltmem gerek mi? (sıcakta düzelt) → tehlikeli, son çare
  - Bekleyebilir mi? (third-party arıza) → bilgilendir, bekle

00:10 — MÜŞTERİYE İLK BİLDİRİM (P0 ise)
  - "Sorunun farkındayız, üzerinde çalışıyoruz, X dakika içinde güncelleyeceğim"

00:30 — ÇÖZÜM UYGULANIYOR

01:00 — DOĞRULAMA + MÜŞTERİYE GÜNCELLEME

+24h — POST-MORTEM YAZIMI
  - docs/incidents/YYYY-MM-DD-<isim>.md
  - Ne oldu, ne zaman, neden, nasıl çözüldü, tekrarı nasıl önlenir
```

---

## ASLA Yapma — Acil Durumda Bile

- 🚫 Müşteriye haber vermeden büyük rollback (veri kaybı varsa müşteri onayı şart)
- 🚫 Production DB'ye doğrudan SQL (Senaryo D dışında, ve orada bile dikkat)
- 🚫 `git push --force` ile geçmiş silmek (history audit trail'i)
- 🚫 Pre-commit/CI hook'larını `--no-verify` ile bypass
- 🚫 Backup şifreleme anahtarını kaybetmek (KEY + KEY_OLD'u 2 yerde tut)
- 🚫 Sözel taahhüt vermek ("hemen düzeltiyorum, 5 dk içinde") — gerçekçi süre ver
- 🚫 Tek başına büyük karar (kayıt silme, full restore) — ekip varsa 4-eyes prensibi

---

## Düzenli Tatbikatlar

Bu runbook ancak çalıştırılarak öğrenilir. Takvim:

| Sıklık | Tatbikat | Kim |
|--------|----------|-----|
| Aylık | `node scripts/restore-drill.js` (drill) | Operatör |
| 3 ayda bir | Staging'e gerçek restore (Senaryo C adımları) | Operatör |
| 6 ayda bir | "Bozuk deploy" simülasyonu — Senaryo A'yı sahte kır + onar | Operatör |
| Yıllık | Tüm runbook'u ekiple gözden geçir, güncel mi? | Tüm ekip |

---

## Post-Mortem Şablonu

Her olaydan sonra `docs/incidents/YYYY-MM-DD-<kısa-isim>.md` yaz:

```markdown
# [Olay başlığı]

**Tarih:** YYYY-MM-DD HH:MM (TR saati)
**Süre:** X dakika
**Etki:** [kaç kullanıcı, hangi feature, veri kaybı?]
**Seviye:** P0/P1/P2

## Ne oldu (kronoloji)
- HH:MM — ilk belirti
- HH:MM — tespit
- HH:MM — kararı (Senaryo X)
- HH:MM — çözüm uygulandı
- HH:MM — doğrulandı

## Niye oldu (kök neden)
[5-Whys analizi]

## Nasıl çözdük
[Hangi senaryonun adımları]

## Tekrar etmemesi için
- [ ] Aksiyon 1 (kim, ne zaman)
- [ ] Aksiyon 2

## Müşteriyle iletişim
- HH:MM — ilk bildirim
- HH:MM — güncelleme
- HH:MM — kapanış
```

---

## Sonraki Doc

- [docs/disaster-recovery.md](./disaster-recovery.md) — Büyük felaketler (DB ölümü, S3 kaybı)
- [docs/STAGING_SETUP.md](./STAGING_SETUP.md) — Staging ortamı kullanımı
- [docs/SLA.md](./SLA.md) — Müşteriye verilen taahhütler (yazılacak)
- [docs/INCIDENT_TEMPLATE.md](./INCIDENT_TEMPLATE.md) — Olay bildirim şablonu (yazılacak)
