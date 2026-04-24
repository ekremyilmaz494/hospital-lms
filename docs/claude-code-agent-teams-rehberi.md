# Claude Code — Agent Teams (Ajan Takımları) Rehberi

> Kaynak: https://code.claude.com/docs/en/agent-teams
> Bu dosya, ileride hospital-lms üzerinde çoklu-ajan (multi-agent) çalışma kurarken başvuru için hazırlanmış Türkçe özet + pratik kullanım rehberidir.

> ⚠️ **Experimental özellik.** Varsayılan olarak kapalıdır. Bilinen kısıtlamaları (resume yok, nested team yok, vb.) vardır — detaylar aşağıda.
> ✅ **Sürüm gereksinimi:** Claude Code **v2.1.32** veya üstü. Kontrol: `claude --version`.

---

## 1. Agent Teams Nedir?

**Agent Teams**, birden fazla Claude Code instance'ının tek bir görev üzerinde takım olarak çalışmasıdır:

- **Lead (takım lideri):** Takımı kuran, görev dağıtan, sonuçları senteze alan ana oturum.
- **Teammate (takım arkadaşı):** Kendi bağımsız context window'u olan ayrı Claude Code instance'ları.
- **Task list (ortak görev listesi):** Takımdaki tüm ajanların görebildiği, claim edebildiği paylaşımlı liste.
- **Mailbox (mesaj kutusu):** Ajanların birbirine doğrudan mesaj gönderdiği sistem.

Kullanıcı olarak **her bir teammate ile doğrudan konuşabilirsin** — lead üzerinden geçmene gerek yok. Bu, subagent'lardan temel farktır.

---

## 2. Subagent vs Agent Team — Hangisini Seçmeli?

| Özellik | Subagents | Agent Teams |
|---------|-----------|-------------|
| **Context** | Kendi context'i, sonuç ana ajana döner | Kendi context'i, tamamen bağımsız |
| **İletişim** | Sadece ana ajana rapor | Ajanlar birbirine doğrudan mesaj gönderir |
| **Koordinasyon** | Ana ajan tüm işi yönetir | Paylaşımlı task list + self-coordination |
| **Uygun** | Odaklı görev, sadece sonuç önemliyse | Tartışma/işbirliği gereken kompleks iş |
| **Token maliyeti** | Düşük — sonuç özetlenerek dönüyor | Yüksek — her teammate ayrı Claude instance'ı |

**Ne zaman agent team?** Teammate'lerin birbiriyle konuşması, birbirinin bulgularını sorgulaması gerekiyorsa.
**Ne zaman subagent?** Hızlı, odaklı worker ve sadece sonucu geri almak yetiyorsa.

---

## 3. Aktifleştirme

İki yoldan biriyle `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set et:

**a) Shell environment:** `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**b) settings.json (önerilen — kalıcı):**
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

> `.claude/settings.local.json` içine konursa sadece senin makinende, `.claude/settings.json` içinde olursa ekipteki herkeste geçerli olur.

---

## 4. İlk Takımı Kurmak

Aktifleştirdikten sonra doğal dille iste:

```text
TODO yorumlarını takip eden bir CLI aracı tasarlıyorum. Bu problemi
farklı açılardan ele alacak bir agent team kur: biri UX, biri teknik
mimari, biri devil's advocate (şüpheci) olsun.
```

Claude bunu alır, takımı oluşturur, paylaşımlı task list açar, her teammate'i spawn eder, çalıştırır ve sonunda takımı temizler.

### Hospital-LMS'e özel örnekler

**Paralel kod inceleme:**
```text
PR #142'yi incele. 3 reviewer teammate spawn et:
- biri güvenlik (RLS, organizationId filtreleri, input validation)
- biri performans (Cache-Control, Promise.all, N+1 sorgu)
- biri test coverage (Vitest + Playwright)
Her biri kendi bulgularını raporlasın.
```

**Çoklu hipotez debug:**
```text
Exam akışında kullanıcılar "sınavı başlatamıyorum" diyor. 4 teammate
spawn et, her biri farklı hipotezi araştırsın:
- Supabase RLS policy sorunu
- Redis timer state sorunu
- Middleware auth redirect döngüsü
- Layout guard vs middleware tutarsızlığı
Bilimsel tartışma gibi birbirlerinin teorilerini çürütmeye çalışsınlar.
Consensus'a varınca bulgular dosyasını güncelleyin.
```

**Cross-layer refactor:**
```text
Eğitim atama akışını yenileyeceğiz. 3 teammate:
- biri backend API (src/app/api/admin/trainings/)
- biri frontend (src/app/admin/trainings/ + components/)
- biri test (Vitest + e2e)
Her biri kendi katmanını sahiplensin, dosya çakışması yok.
```

---

## 5. Kontrol Etme

### Display modları (görüntüleme)

| Mod | Davranış | Gereksinim |
|-----|----------|-----------|
| **in-process** | Tüm teammate'ler ana terminalde. `Shift+Down` ile aralarında geçiş yap. | Hiçbir şey — her terminalde çalışır |
| **split panes** | Her teammate kendi pane'inde. Pane'e tıklayıp doğrudan etkileşime gir. | **tmux** veya **iTerm2** (it2 CLI + Python API) |

Windows için: `tmux` Windows'ta sınırlı çalışır, **in-process mode** bizim için daha stabil.

**Global ayar (`~/.claude.json`):**
```json
{
  "teammateMode": "in-process"
}
```

**Tek oturum için flag:**
```bash
claude --teammate-mode in-process
```

**Varsayılan:** `"auto"` — tmux içindeysen split, değilsen in-process.

### Teammate ve model sayısını belirtme

```text
Bu modülleri paralel refactor etmek için 4 teammate'lik takım kur.
Her biri Sonnet kullansın.
```

### Plan onayı zorunluluğu (risk azaltma)

```text
Auth modülünü refactor edecek bir architect teammate spawn et.
Herhangi bir değişiklik yapmadan ÖNCE plan onayı gerektirsin.
```

Teammate read-only plan mode'da çalışır, planı lead'e gönderir. Lead onaylarsa implementation'a geçer, reddedilirse planı revize eder.

**Lead'in karar kriterini etkilemek için** spawn prompt'a ekle:
- "Sadece test coverage içeren planları onayla"
- "DB şema değişikliği içeren planları reddet"
- "Prisma migration içeren planlar için bana önce sor"

### Teammate ile doğrudan konuşma

- **in-process mode:** `Shift+Down` ile teammate seç → mesaj yaz. `Enter` ile oturumunu aç, `Esc` ile current turn'ü interrupt et. `Ctrl+T` task list toggle.
- **split-pane mode:** Pane'e tıkla, normal Claude Code oturumu gibi etkileşime gir.

### Görev atama / claim

Task durumları: **pending → in progress → completed**. Task'lar başka task'lara dependency koyabilir (blocking). File locking ile race condition önlenir.

- **Lead assign:** "trainer teammate'e task #3'ü ver"
- **Self-claim:** Bir teammate işini bitirince unblocked ve unassigned olan bir sonraki task'ı kendi alır

### Teammate'i shutdown etme

```text
researcher teammate'den kapanmasını iste
```

Lead shutdown isteği gönderir. Teammate kabul edip graceful çıkar veya açıklamayla reddeder.

### Takımı temizleme (cleanup)

```text
Takımı temizle
```

> ⚠️ **Cleanup'ı her zaman lead yapmalı.** Teammate yaparsa context tam çözülmeyebilir, resource'lar tutarsız kalabilir.

Cleanup aktif teammate varsa fail eder — önce shutdown et.

---

## 6. Quality Gate Hooks

Lifecycle hook'larıyla kuralları zorla:

| Hook | Tetiklendiği an | Exit 2 etkisi |
|------|----------------|---------------|
| `TeammateIdle` | Teammate idle olmadan hemen önce | Feedback döner, teammate çalışmaya devam eder |
| `TaskCreated` | Task oluşturulurken | Task oluşumu engellenir + feedback |
| `TaskCompleted` | Task complete olarak işaretlenirken | Tamamlanma engellenir + feedback |

**Hospital-LMS için örnek:** TaskCompleted hook'unda `pnpm tsc --noEmit && pnpm lint` çalıştır — geçmezse teammate'e "tip hataları var, düzelt" feedback'i dön.

---

## 7. Mimari Detaylar

### Takım nasıl başlar

1. **Sen istersen:** Paralel işten yararlanacak görev veriyorsun + explicit "agent team kur" diyorsun.
2. **Claude önerirse:** Görevin fayda sağlayacağına karar verip sorar, sen onaylarsan kurulur.

Her iki durumda da **sen onaylamadan takım kurulmaz.**

### Dosya konumları

- **Team config:** `~/.claude/teams/{team-name}/config.json`
- **Task list:** `~/.claude/tasks/{team-name}/`

> ⛔ **Bu dosyaları elle düzenleme/pre-author etme** — Claude runtime state tutar (session ID, tmux pane ID), her state update'te üzerine yazılır.

**Proje-level team config YOK.** `.claude/teams/teams.json` gibi bir dosya konfigürasyon olarak tanınmaz, sıradan dosya olarak muamele görür.

Team config içinde `members` array'i vardır — her teammate'in adı, agent ID'si, agent type'ı. Teammate'ler bu dosyayı okuyup diğer takım üyelerini keşfedebilir.

### Teammate için subagent definition kullanma

Takıma özel role tanımı için (mesela `security-reviewer`, `test-runner`) subagent scope'larından birini kullan:
- project (`.claude/agents/`)
- user (`~/.claude/agents/`)
- plugin
- CLI-defined

```text
security-reviewer agent type'ını kullanarak auth modülünü denetleyecek
bir teammate spawn et.
```

Teammate o definition'ın `tools` allowlist'ini ve `model` ayarını benimser. Definition body'si **sistem prompt'a eklenir** (değiştirmez).

> **Not:** Subagent frontmatter'ındaki `skills` ve `mcpServers` alanları teammate olarak çalışırken **uygulanmaz**. Teammate skill ve MCP sunucularını project/user settings'ten yükler — normal oturum gibi.

`SendMessage` ve task management tool'ları teammate'te **her zaman açıktır**, `tools` allowlist'i başka tool'ları kısıtlasa bile.

### Permissions

- Teammate'ler **lead'in permission ayarlarıyla başlar**.
- Lead `--dangerously-skip-permissions` ile çalışıyorsa tüm teammate'ler de öyle çalışır.
- Spawn sonrası tek tek teammate mode değiştirebilirsin, ama **spawn anında per-teammate mode ayarlanamaz**.

### Context ve iletişim

Teammate spawn edilince yüklenenler:
- `CLAUDE.md` dosyaları
- MCP servers
- Skills
- Lead'in gönderdiği spawn prompt

**Yüklenmeyen:** Lead'in konuşma geçmişi — teammate onu görmez. Bu yüzden spawn prompt'u **kendi kendini açıklayıcı** olmalı.

**Mesajlaşma tipleri:**
- **message:** Tek bir teammate'e özel mesaj
- **broadcast:** Tüm teammate'lere aynı anda — **dikkatli kullan**, maliyet team size ile çarpılır

**Öngörülebilir isimler için:** Spawn ederken lead'e "bu teammate'i `security-lead` olarak çağır" gibi açık isim ver — sonra prompt'larda bu isimle refer edebilirsin.

### Token kullanımı

Agent teams **tek oturumdan çok daha fazla token tüketir.** Her teammate ayrı context window.

- Research/review/new feature → ekstra token değer.
- Rutin görev → tek oturum daha ekonomik.

---

## 8. Best Practices

### ✅ Teammate'e yeterli context ver

```text
Security reviewer teammate spawn et şu prompt'la:
"src/auth/ altındaki authentication modülünü güvenlik açıkları için
incele. Token handling, session management, input validation odaklan.
App JWT token'larını httpOnly cookie'de saklıyor. Bulunan her sorunu
severity rating ile raporla."
```

### ✅ Doğru takım boyutu

- **Başlangıç:** Çoğu workflow için **3-5 teammate**.
- **Task/teammate oranı:** 5-6 task/teammate → herkesi meşgul tutar, lead stuck olanı reassign edebilir.
- **Örnek:** 15 bağımsız task → 3 teammate iyi başlangıç.

> **3 odaklı teammate, 5 dağınık teammate'ten sık sık daha iyi performans gösterir.**

### ✅ Task boyutu

- **Çok küçük:** Koordinasyon overhead'i faydayı aşar.
- **Çok büyük:** Teammate uzun süre check-in olmadan çalışır, boşa efor riski.
- **İdeal:** Self-contained unit — bir function, bir test dosyası, bir review.

### ✅ Teammate'lerin bitmesini bekle

Lead bazen teammate'leri beklemeden kendi implement etmeye başlar:
```text
Devam etmeden önce teammate'lerinin task'larını bitirmesini bekle.
```

### ✅ Research/review ile başla

İlk denemede kod yazmayan görevler seç: PR inceleme, library araştırma, bug investigation. Paralel keşfin değerini coordination zorluğu olmadan gösterir.

### ✅ Dosya çakışmasından kaç

İki teammate'in aynı dosyayı editlemesi overwrite'a yol açar. **İşi her teammate farklı dosya setine sahip olacak şekilde böl.**

### ✅ Monitor ve yönlendir

İlerlemeyi kontrol et, yanlış giden approach'ı düzelt, bulguları geldiği gibi senteze al. **Team'i uzun süre unattended bırakma** — boşa efor riski artar.

---

## 9. Troubleshooting

| Sorun | Çözüm |
|-------|-------|
| Teammate görünmüyor | `Shift+Down` ile cycle et — in-process'te arka planda olabilir. Task'ın team gerektirecek kadar kompleks olduğundan emin ol |
| tmux bulunamıyor | `which tmux` kontrol et, yoksa package manager'dan kur |
| iTerm2 split çalışmıyor | `it2` CLI kurulu mu? iTerm2 → Settings → General → Magic → Enable Python API açık mı? |
| Çok fazla permission prompt'u | Spawn öncesi [permission settings](https://code.claude.com/docs/en/permissions)'ta common operations'ları pre-approve et |
| Teammate error'da duruyor | `Shift+Down` ile output'u gör → ya doğrudan talimat ver ya replacement teammate spawn et |
| Lead iş bitmeden kapatıyor | "Devam et, taskk'lar bitmedi" de. Gerekirse "teammate'ler bitene kadar bekle" diye yönlendir |
| Orphaned tmux session | `tmux ls` → `tmux kill-session -t <session-name>` |

---

## 10. Bilinen Kısıtlamalar (Experimental)

- ❌ **In-process teammate'lerde `/resume` ve `/rewind` çalışmaz.** Session resume sonrası lead artık var olmayan teammate'lere mesaj atmaya çalışabilir. Bu olursa: yeni teammate'ler spawn etmesini söyle.
- ⏳ **Task status gecikebilir.** Teammate bazen task'ı completed işaretlemeyi atlar → dependent task'lar block olur. Manuel status update'i veya lead'e nudge etmesini söyleme.
- 🐢 **Shutdown yavaş olabilir.** Teammate current request/tool call'ını bitirmeden çıkmaz.
- 🔒 **Oturum başına tek takım.** Lead aynı anda tek takım yönetir. Yeni takım için önce cleanup.
- 🚫 **Nested team yok.** Teammate kendi teammate'ini spawn edemez. Sadece lead takım yönetir.
- 🔐 **Lead sabit.** Takımı kuran oturum ömür boyu lead'dir. Transfer / promote yok.
- ⚙️ **Permission'lar spawn anında set.** Sonra tek tek değiştirebilirsin, spawn anında per-teammate ayarlanamaz.
- 🖥️ **Split panes için tmux/iTerm2 şart.** VS Code integrated terminal, Windows Terminal, Ghostty'de çalışmaz. In-process her yerde çalışır.

> 💡 **`CLAUDE.md` normal çalışır** — teammate'ler working directory'deki CLAUDE.md'yi okur. Proje-spesifik kılavuzu tüm teammate'lere vermek için bunu kullan.

---

## 11. Alternatifler

Paralel iş için farklı yaklaşımlar:

- **Subagents** (hafif delegasyon) — Bulgu paylaşımı ve inter-agent koordinasyon **gerekmiyorsa** tercih et. Research/verification için ideal.
- **Git worktrees** (manuel paralel oturum) — Otomatik koordinasyon istemiyorsan birden fazla Claude Code oturumunu kendin yönet.

---

## 12. Hospital-LMS İçin Hızlı Başlangıç Şablonları

### 🔍 Güvenlik audit takımı
```text
Hospital-LMS'nin güvenlik auditi için 3 teammate'lik takım kur:
- RLS-reviewer: supabase-rls.sql + organizationId filter denetimi
- auth-reviewer: src/lib/supabase/* + middleware.ts + login akışı
- api-reviewer: src/app/api/ altında service_role kullanımı ve input validation
Bulguları docs/security-audit-YYYY-MM-DD.md'ye yazsınlar.
```

### 📊 Performance regresyon takımı
```text
Son 2 hafta commit'lerinde perf regression ara. 3 teammate:
- api-perf: GET endpoint'lerde Cache-Control ve Promise.all
- client-perf: useMemo, O(n×m) nested loop, provider ağır iş
- db-perf: select vs include, N+1, missing index
perf-check.js sonuçlarını referans al.
```

### 🧪 Test coverage takımı
```text
Coverage %80 altındaki modülleri bul ve kapatmak için 4 teammate spawn et.
Her biri farklı dizini sahiplensin:
- src/lib/
- src/app/api/auth/
- src/app/api/admin/trainings/
- src/app/api/exam/
Vitest unit + gerekirse Playwright e2e yazsınlar.
```

### 🏥 Yeni modül paralel geliştirme
```text
Hasta şikayet yönetimi modülü için 3 teammate:
- schema + API (prisma/schema.prisma + src/app/api/admin/complaints/)
- admin UI (src/app/admin/complaints/)
- staff UI (src/app/staff/complaints/)
Koordinasyonu task list üzerinden yapsınlar, her biri CLAUDE.md
kurallarına uysun (Cache-Control, Promise.all, organizationId filter).
```

---

## 13. Takım Kurarken Kontrol Listesi

- [ ] Görev gerçekten paralelleştirilebilir mi? (Sequential ya da same-file işler için takım kurma)
- [ ] `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set mi?
- [ ] Claude Code sürümü ≥ v2.1.32 mi?
- [ ] Her teammate farklı dosya setine mi sahip? (File conflict riski yok)
- [ ] Spawn prompt'u self-contained mi? (Lead'in konuşma geçmişi aktarılmaz)
- [ ] Risk yüksekse plan approval zorunlu mu?
- [ ] Teammate isimleri öngörülebilir mi verildi? ("bu teammate'i X olarak çağır")
- [ ] Kaç teammate? (3-5 arası çoğu görev için yeterli)
- [ ] Task/teammate oranı 5-6 mı? (Değilse lead'e "task'ları daha küçük parçalara böl" de)
- [ ] Quality gate hook'ları gerekli mi? (TaskCompleted'da tsc/lint vs.)
- [ ] Cleanup planı var mı? (Bitince "Takımı temizle")

---

**Son güncelleme:** 2026-04-23 — Agent Teams dokümantasyonu v2.1.32 sürümüne göre.
