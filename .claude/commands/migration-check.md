---
description: Prisma schema ile migrations klasörü arasında drift kontrolü (CI'daki kontrolün yerel sürümü)
allowed-tools: Bash, Read
---

# /migration-check

CLAUDE.md kritik kuralı: **"Her `schema.prisma` commit'inde `prisma/migrations/` altında yeni klasör olmalı"**. Nisan 2026'da `pnpm db:push` yüzünden 8 tablo + 40 kolon drift oldu, fresh ortamı kırdı.

Bu komut commit öncesi drift'i yakalar.

## Görev

1. `git diff --name-only HEAD~1...HEAD` veya staged değişikliklerden `prisma/schema.prisma` dokunulmuş mu kontrol et.
2. Eğer evet → `prisma/migrations/` altında YENİ bir klasör eklenmiş mi kontrol et (aynı diff'te).
3. Eklenmemişse → 🔴 DRIFT UYARISI ver, kullanıcıya `pnpm db:migrate dev --name <açıklayıcı>` çalıştırmasını söyle.
4. Bonus: `prisma migrate status` çalıştırıp DB ile migration klasörü arasındaki durumu özetle (eğer DB erişimi varsa; yoksa sessizce atla).
5. `pnpm-lock.yaml`'da `prisma`/`@prisma/*` versiyon değişikliği varsa uyar (migration formatı kırılabilir).

## Çıktı formatı

```
🔍 schema.prisma değişiklikleri: 12 satır eklendi, 3 silindi
🔍 prisma/migrations/ yeni klasör: ❌ YOK
🔴 DRIFT — Şema değişti ama migration üretilmedi.

Çözüm:
  pnpm db:migrate dev --name add_certificate_template

Hatırlatma:
  - pnpm db:push YASAK (CLAUDE.md)
  - migration SQL'i fresh DB'de çalışmalı (UPDATE/ALTER için IF EXISTS)
```

## Yaklaşım

```bash
git diff --name-only --cached | grep -E '^prisma/'
git status --short prisma/
```

`$ARGUMENTS` verilmişse o commit/branch ile karşılaştır, yoksa staged + working tree.
