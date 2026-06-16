# Hospital LMS — Doküman İndeksi

> Son güncelleme: 2026-05-08
> Bu klasördeki tüm dokümanlar için hızlı navigasyon.

## Hangi Durumdayım?

Aşağıdaki sorulardan size uygun olanı seçin, ilgili doc'a gidin.

### "Sistem üzerinde çalışıyorum, ne yapacağımı bilmiyorum"

| Durumum | Bakacağım Doc |
|---------|---------------|
| Projeye yeni katıldım | [ONBOARDING.md](./ONBOARDING.md) |
| Genel proje kurallarını öğrenmek istiyorum | [../CLAUDE.md](../CLAUDE.md) |
| Performans kurallarını anlamak istiyorum | [../PERFORMANCE_RULES.md](../PERFORMANCE_RULES.md) |
| Staging ortamı nasıl kullanılıyor? | [STAGING_SETUP.md](./STAGING_SETUP.md) |
| Deploy nasıl yapılıyor? | [deployment-guide.md](./deployment-guide.md) |
| Claude Code ile takım nasıl kurulur? | [claude-code-agent-teams-rehberi.md](./claude-code-agent-teams-rehberi.md) |

### "Müşteri ile ilgili bir konu var"

| Durumum | Bakacağım Doc |
|---------|---------------|
| Müşteri sözleşmesinde SLA maddeleri lazım | [SLA.md](./SLA.md) |
| Müşteriye olay bildirimi göndermem lazım | [INCIDENT_TEMPLATE.md](./INCIDENT_TEMPLATE.md) |
| KVKK uyumluluğu hakkında soru | [kvkk-teknik-uyum.md](./kvkk-teknik-uyum.md) |
| Müşteri admin panelinde kayboldum | [admin-guide.md](./admin-guide.md) |
| Personel paneli kullanım sorusu | [staff-guide.md](./staff-guide.md) |
| Veri güvenliği teknik özet | [veri-guvenligi-teknik-ozet.md](./veri-guvenligi-teknik-ozet.md) |

### "Bir şey kırıldı / bozuldu"

| Durumum | Bakacağım Doc |
|---------|---------------|
| Bozuk deploy / migration / veri durumu var | [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) |
| Sistem tamamen çöktü (DB, S3 vs.) | [disaster-recovery.md](./disaster-recovery.md) |
| Müşteriye nasıl haber vereceğim? | [INCIDENT_TEMPLATE.md](./INCIDENT_TEMPLATE.md) |
| Acil monitoring kontrolü | [go-live-monitoring-runbook.md](./go-live-monitoring-runbook.md) |

### "Müşteriyi canlıya almaya hazırlanıyorum"

| Durumum | Bakacağım Doc |
|---------|---------------|
| Genel hazırlık kontrol listesi (büyük resim) | [go-live-checklist.md](./go-live-checklist.md) |
| Mevcut güvenlik script'lerini doğrula (komut komut) | [PRE_LAUNCH_VERIFICATION.md](./PRE_LAUNCH_VERIFICATION.md) |
| Canlı sonrası izleme | [go-live-monitoring-runbook.md](./go-live-monitoring-runbook.md) |

---

## Doküman Listesi (Alfabetik)

| Doküman | Konu | Kim İçin | Son Güncelleme |
|---------|------|----------|----------------|
| [admin-guide.md](./admin-guide.md) | Hastane yöneticisi paneli kullanımı | Müşteri Esas Yöneticisi | — |
| [claude-code-agent-teams-rehberi.md](./claude-code-agent-teams-rehberi.md) | Claude Code takım yapılandırması | Operatör | — |
| [deployment-guide.md](./deployment-guide.md) | Deploy süreci | Operatör | — |
| [disaster-recovery.md](./disaster-recovery.md) | Büyük felaket senaryoları (RTO/RPO) | Operatör | 2026-04-09 |
| [go-live-checklist.md](./go-live-checklist.md) | Canlıya çıkış öncesi genel kontrol listesi | Operatör | 2026-04-05 |
| [go-live-monitoring-runbook.md](./go-live-monitoring-runbook.md) | Canlıya çıkış sonrası izleme | Operatör | 2026-04-23 |
| **[INCIDENT_TEMPLATE.md](./INCIDENT_TEMPLATE.md)** ⭐ | Olay yönetimi şablonları | Operatör + Müşteri | 2026-05-08 |
| [kvkk-teknik-uyum.md](./kvkk-teknik-uyum.md) | KVKK uyumluluk teknik detay | Operatör + Hukuk | — |
| **[ONBOARDING.md](./ONBOARDING.md)** ⭐ | Yeni geliştirici 1. gün rehberi | Yeni Dev | 2026-05-08 |
| **[PRE_LAUNCH_VERIFICATION.md](./PRE_LAUNCH_VERIFICATION.md)** ⭐ | 200 kişilik müşteriden önce script çalıştırma | Operatör | 2026-05-08 |
| [README.md](./README.md) | Bu dosya — doküman indeksi | Herkes | 2026-05-08 |
| **[ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md)** ⭐ | Sorun çıktığında teknik adımlar | Operatör | 2026-05-08 |
| **[SLA.md](./SLA.md)** ⭐ | Müşteri sözleşmesi teknik eki | Operatör + Müşteri | 2026-05-08 |
| [staff-guide.md](./staff-guide.md) | Personel paneli kullanımı | Müşteri Personel | — |
| [STAGING_SETUP.md](./STAGING_SETUP.md) | Staging ortamı kurulum + kullanım | Operatör | — |
| [veri-guvenligi-teknik-ozet.md](./veri-guvenligi-teknik-ozet.md) | Veri güvenliği teknik özet | Operatör + Müşteri | — |

⭐ = 200 kişilik müşteri için canlı geçiş hazırlığında 2026-05-08'de eklenen yeni doc'lar.

---

## Doküman Aileleri

İşlevsel olarak ilişkili doc'lar:

### Aile 1 — Operasyon ve Olay Yönetimi

```
SLA.md ────────► Müşteriye yazılı taahhüt
   │
   ├─► INCIDENT_TEMPLATE.md ──► Müşteriye nasıl bildirim
   │
   ├─► ROLLBACK_RUNBOOK.md ───► Sorun çıkınca teknik müdahale
   │
   └─► disaster-recovery.md ──► Büyük felaket senaryoları
```

**Akış:** SLA'da söz verilen şey kırıldığında → INCIDENT_TEMPLATE ile müşteriye haber → ROLLBACK_RUNBOOK ile teknik düzelt → daha büyükse disaster-recovery.

### Aile 2 — Canlıya Çıkış Hazırlığı

```
go-live-checklist.md ──────► Genel BÜYÜK kontrol listesi
   │
   └─► PRE_LAUNCH_VERIFICATION.md ──► Spesifik script çalıştırma
       │
       └─► go-live-monitoring-runbook.md ──► Canlıdan sonra izleme
```

**Akış:** go-live-checklist'i tepeden in → PRE_LAUNCH_VERIFICATION'da komut komut çalıştır → canlı olunca go-live-monitoring-runbook ile izle.

### Aile 3 — Geliştirici Eğitimi

```
ONBOARDING.md (1-5. gün) ──► CLAUDE.md (kurallar) ──► PERFORMANCE_RULES.md (perf disiplini)
                                  │
                                  └─► STAGING_SETUP.md (lokal kurulum + staging)
                                          │
                                          └─► deployment-guide.md (deploy süreci)
```

### Aile 4 — Müşteri Tarafı

```
admin-guide.md ─────► Esas Yönetici nasıl kullanır
staff-guide.md ─────► Personel nasıl kullanır
```

### Aile 5 — Yasal / Uyumluluk

```
kvkk-teknik-uyum.md ──────► KVKK detayları
veri-guvenligi-teknik-ozet.md ──► Müşteriye gösterilebilir özet
SLA.md ──────► Hizmet seviyesi taahhütleri
```

---

## Hızlı Karar Ağacı (Acil Durum)

```
Sorun ne?
│
├── Sistem down (P0)
│   ├── 1. ROLLBACK_RUNBOOK.md → Acil Protokol
│   ├── 2. INCIDENT_TEMPLATE.md → Müşteriye P0 bildirimi
│   └── 3. go-live-monitoring-runbook.md → Hangi servis?
│
├── Veri kaybı tespit edildi
│   ├── 1. ROLLBACK_RUNBOOK.md → Senaryo C/D
│   └── 2. disaster-recovery.md → RTO/RPO referansı
│
├── Müşteri bir şey soruyor
│   ├── Teknik: admin-guide.md, staff-guide.md
│   ├── KVKK: kvkk-teknik-uyum.md
│   └── SLA ihlali iddiası: SLA.md → Madde 12
│
├── Yeni feature ekleyeceğim
│   ├── 1. ONBOARDING.md → Konvansiyonlar
│   ├── 2. STAGING_SETUP.md → Staging'de test
│   └── 3. ROLLBACK_RUNBOOK.md → Risk piramidi
│
└── Müşteri demo / canlıya geçecek
    ├── 1. go-live-checklist.md → Genel hazırlık
    ├── 2. PRE_LAUNCH_VERIFICATION.md → Script doğrulamaları
    └── 3. SLA.md → Sözleşme imzası
```

---

## Doküman Bakım Kuralları

Bu klasördeki doc'ları güncellerken:

1. **Her doc'un başında "Son güncelleme" tarihi** olmalı
2. **Büyük değişikliklerde sürüm tarihçesi** ekle (Ek B gibi — örn. SLA.md'de var)
3. **İlişkili doc'lara link ver** — her doc kendi başına okunabilir olmalı
4. **CLAUDE.md ile çakışma olmamalı** — CLAUDE.md tek doğruluk kaynağı, doc'lar onu genişletir
5. **Müşteriye gösterilen doc'lar** (SLA.md, INCIDENT_TEMPLATE.md template'leri) ayrı tutulmalı, iç doc'lardan ayrılmalı

### Doc Değişiklikleri Onay Süreci

- **Müşteri-yüzlü doc'larda değişiklik (SLA, INCIDENT, admin-guide, staff-guide)**: PR + Owner onayı
- **İç doc'lar (ONBOARDING, ROLLBACK_RUNBOOK, vs.)**: PR yeter
- **Acil durum playbook'ları (ROLLBACK, disaster-recovery, monitoring)**: değişiklik sonrası bir tatbikat yapılmalı

---

## Eksik / Geliştirilecek Doc'lar

Plan dosyasında belirtilen ama henüz yazılmamış (Faz 0 çıktıları):

- ⬜ `docs/incidents/` klasörü — gelecek olaylar için (her olay sonrası ekle)
- ⬜ Müşteri sözleşme şablonu (avukat ile birlikte yazılır, repo dışı tutulabilir)
- ⬜ KVKK Veri İşleyen Sözleşmesi (template) — kvkk-teknik-uyum.md ile birleşik veya ayrı

---

## İletişim

Bu doc'lar hakkında soru, hata düzeltme, eksik fark ettiğinde:
- GitHub Issue aç (etiket: `docs`)
- Owner'a Slack/E-posta
