---
name: diff-review
description: Güvenlik odaklı PR/commit fark analizi — risk sınıflandırması ile (Trail of Bits metodolojisi)
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Diferansiyel Güvenlik İncelemesi — Hospital LMS

Trail of Bits'in "differential-review" metodolojisini bu projeye uygula.

## Ne Zaman Kullan

- Yeni bir feature branch'i merge etmeden önce
- Auth, exam, payment veya admin endpoint'leri değiştiğinde
- Multi-tenant izolasyonuna dokunan herhangi bir değişiklikte

## Ne Zaman Kullanma

- Sadece documentation güncellemesi olan PR'larda
- Test ve UI string değişikliklerinde (yine de LOW risk olarak işaretle)

## Reddetmen Gereken Gerekçeler (Anti-Patterns)

- "Küçük değişiklik, risk yok" → Küçük değişiklikler büyük güvenlik açıkları yaratabilir
- "Bu kodu biliyorum, detaylı incelemeye gerek yok" → Tanıdıklık kör nokta yaratır
- "Testler geçiyor, güvenli demek" → Testler güvenliği garanti etmez
- "Sadece refactor, logic değişmedi" → Refactor'lar davranış değiştirebilir
- "Findings var ama commit süresi geçti" → Güvenlik bulguları sözlü aktarılmaz, yazıya dökülür

## Altı Aşamalı İş Akışı

### Aşama 1 — İlk Değerlendirme

```bash
# Değişen dosyaları listele
git diff --name-only HEAD~1..HEAD

# Kısa istatistik
git diff --stat HEAD~1..HEAD

# Commit mesajını oku
git log --oneline -5
```

**Risk sınıflandırması:**
- 🔴 **YÜKSEK**: Auth, exam submit, impersonation, suspend, role assignment
- 🟡 **ORTA**: Dashboard API, training CRUD, staff management
- 🟢 **DÜŞÜK**: UI bileşenleri, statik sayfalar, CSS

### Aşama 2 — Kod İncelemesi

Her değişen dosya için kontrol listesi:

**API Route'ları için:**
- [ ] `getAuthUser()` çağrılıyor mu?
- [ ] `requireRole()` doğru rol ile kullanılıyor mu?
- [ ] Zod validation var mı?
- [ ] `organizationId` her Prisma sorgusunda filtre olarak var mı?
- [ ] Hassas işlem için `createAuditLog()` çağrılıyor mu?

**Client Components için:**
- [ ] Hassas veri localStorage/sessionStorage'a yazılıyor mu?
- [ ] Kullanıcı girdisi doğrudan DOM'a ekleniyor mu? (XSS)
- [ ] API çağrıları hata durumlarını ele alıyor mu?

### Aşama 3 — Test Doğrulama

- Değiştirilen koda karşılık test var mı?
- Edge case'ler (null, undefined, boş dizi, sınır değerler) test edilmiş mi?
- Multi-tenant izolasyon testi var mı?

### Aşama 4 — Etki Analizi (Blast Radius)

```bash
# Bu dosyayı kim import ediyor?
grep -r "from.*[değiştirilen-dosya]" src/ --include="*.ts" --include="*.tsx"
```

### Aşama 5 — Adversarial Modelleme

Üç perspektiften düşün:
1. **Kötü niyetli kullanıcı**: Auth token'ı manipüle ederse ne olur?
2. **Dikkatsiz admin**: Yanlış organizasyon ID'si gönderirse ne olur?
3. **Başka tenant'ın admin'i**: Cross-tenant veri erişimi mümkün mü?

### Aşama 6 — Final Rapor

## Risk Matrisi

| Dosya | Risk | Sorun | Satır |
|-------|------|-------|-------|
| ... | 🔴/🟡/🟢 | ... | ... |

## Kritik Bulgular
[Her bulgu için: açıklama + somut saldırı senaryosu + etkilenen satır numarası]

## Kapsam Sınırları
[Hangi alanlar incelenmedi, neden]

---
*Trail of Bits "differential-review" v1.0.0 metodolojisi temel alınmıştır.*
