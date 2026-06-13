# Sınav Akışı — Davranış Matrisi (Kullanıcı Aksiyonu × Aşama)

> Bu belge, personel sınav akışında (ön sınav → video → son sınav) kullanıcının her
> hareketine karşı sistemin **nasıl tepki vermesi gerektiğini** ve bu tepkiyi **hangi
> mekanizmanın garantilediğini** tanımlar. Haziran 2026 kök neden çözümünün (N1–N5)
> "spec" katmanıdır — yeni bir davranış değiştirilirken bu matris kontrol edilmeli.

## Tek doğruluk kaynağı

"Kullanıcı hangi atamada + hangi denemede + hangi aşamada?" sorusunun **tek** cevabı:
`resolveExamFlowState` (`src/lib/exam-flow-resolver.ts`). Tüm route'lar ve entrypoint
sayfası bunu kullanır. Doğrudan `prisma.examAttempt.findFirst({ where: { assignmentId... }})`
**yasaktır** (perf-check `exam-attempt-resolver` kuralı commit'i engeller).

**Aşama (stage):** `pre_exam` · `watching_videos` · `post_exam` · `completed`/`expired` (terminal)

---

## Aksiyon × Aşama matrisi

Her hücre: **beklenen tepki** → _(garantileyen mekanizma)_

### 1. Sayfa yenileme (F5) / deep-link `/exam/[id]`
| Aşama | Beklenen tepki |
|---|---|
| pre_exam | Ön sınav ekranı açılır _(entrypoint resolver → `pre-exam` redirect)_ |
| watching_videos | Video ekranı, **kaldığı saniyeden** _(resolver stage + `lastPosition`; useFetch `noStore`)_ |
| post_exam | Son sınav ekranı, kalan süre DB'den hesaplanır _(timer lazy-start + `phaseStartedAt`)_ |
| terminal | Eğitim **detay** sayfası (liste değil) — sertifika/yeniden-dene CTA'sı görünür _(`attemptPhaseRedirect` → `my-training-detail`)_ |

### 2. Tarayıcı geri tuşu / SPA ile çıkıp detail CTA'dan dönüş
| Aşama | Beklenen tepki |
|---|---|
| watching_videos | Video **kaldığı yerden** — baştan başlamaz _(useFetch `noStore: true` + sunucu `Cache-Control: no-store`; perf-check `exam-video-stale-cache`)_ |
| pre_exam'ı bitirip dönüş | **Asla** ön sınava geri atılmaz → video aşaması _(N1 fix: resolver atamaya scope'lu attempt; N4: detail route aktif attempt'te `no-store`)_ |

### 3. Video ortasında çıkıp tekrar girme
- **Beklenen:** `lastPositionSeconds`'tan devam; izlenen toplam (`watchedSeconds`) korunur.
- **Mekanizma:** `flushVideoPosition` (pause/visibility/pagehide) + 15sn heartbeat + `Math.max` geri-gitme guard'ları (`videos/route.ts`). Resume seek `onLoadedMetadata`'da.

### 4. Sekme kapatıp deep-link ile dönüş / sekme >30 dk gizli kalıp dönüş
- **Beklenen:** Sunucunun bildiği aşamaya **sessizce** hizalanır; bayat ekran + ölü modal yok.
- **Mekanizma:** `useExamStageSync` (`visibilitychange`/`focus`, 10sn throttle) → `GET /api/exam/[id]/state` → `redirect` doluysa `router.replace`. videos/pre-exam/post-exam sayfalarına mount.

### 5. Oturum düşmesi (session expiry)
- **Beklenen:** 401 → login'e yönlendir (loop-guard'lı); 403 → hata göster, redirect YAPMA.
- **Mekanizma:** `handleVideoPostFailure('session-expired')` + `use-fetch.ts` loop-guard (30sn'de 2+ → durdur). Bu davranış korundu (değiştirilmedi).

### 6. İkinci sekme açma
- **Beklenen:** İkinci sekme bloklanır (içerik yerine `ExamTabLocked`); ilk sekme devam eder.
- **Mekanizma:** `useExamTabLock` (localStorage tab-lock + heartbeat). İlk sekmenin geçişi, ikinci sekme görünür olunca `useExamStageSync` ile yansır.

### 7. Cron attempt'i expire etti (sekme açıkken) / sınav süresi sekme gizliyken doldu
| Durum | Beklenen tepki |
|---|---|
| Cron expire (24h+ stale / eğitim silindi) | Sekme dönünce terminal aşamaya yönlendirilir _(`useExamStageSync` → state endpoint → `attemptPhaseRedirect`)_ |
| Sınav süresi doldu (TIMEOUT) | Attempt `completed`+`isPassed=false`, deneme harcanır _(timer `autoCompleteExpiredAttempt` → state machine `TIMEOUT`)_ |

### 8. Heartbeat/submit sırasında ağ kopması
- **Beklenen:** Geçici hata → retry; "internet" suçlaması yalnız `navigator.onLine === false` iken; iyimser tamamlama geri alınır.
- **Mekanizma:** `postWithRetry` (backoff) + `saveStatus` banner + `transient` sonucunda `localCompleted` rollback'i.

### 9. Admin eğitimi sınav ortasında değiştirdi (video eklendi/silindi, soru değişti)
| Durum | Beklenen tepki |
|---|---|
| Video silindi | `404` → "İçerik bulunamadı" (dead-end değil, detail'e dönüş) _(`trainingVideo.findFirst` trainingId guard)_ |
| Soru değişti | Skor mevcut soru kümesinden hesaplanır, düşen cevaplar loglanır _(submit `droppedAnswers` warn)_ |
| Video transcode bozuk/eksik | Aşama sessizce atlanmaz; `logger.warn('ExamFlow', ...)` ile teşhis sinyali + transition ekranında açık mesaj |

### 10. Ön sınav sonrası — video yok (PDF-only veya bozuk transcode)
- **Beklenen:** "Bu eğitimde izlenecek video bulunmuyor — doğrudan son sınava geçiyorsun" mesajı; **sessiz atlama yok**.
- **Mekanizma:** `advancePastVideosIfNoneRequired` → `noRequiredVideos` yanıtı → `transition` sayfası `noVideos=1` ile açık mesaj + CTA "Son Sınava Başla".

### 11. Video sonuna kadar izlendi ama "tamamlanmıyor" (şişkin DB süresi)
- **Beklenen:** Video gerçekten bitince tamamlanır; DB `durationSeconds` gerçek süreden büyük olsa bile.
- **Mekanizma (N2):** Client `onended`'de `clientDuration` (oynatıcı ölçümü) gönderir; sunucu %90 tabanını `min(DB, client)` üstünden uygular, alt clamp DB'nin %60'ı (anti-cheat korunur).

### 12. Retry akışına giriş (kaldı, deneme hakkı var)
- **Beklenen:** `requirePreExamOnRetry=false` ise ön sınav atlanır → video; `true` ise baştan.
- **Mekanizma:** start route state machine `START(isRetry, requirePreExamOnRetry)`; resolver yeni atamayı (round) doğru çözer (N1).

---

## Bilinen artık riskler / takip işleri

- **E2E kapsamı:** `e2e/exam-*.spec.ts` seed yokken kendini atlar (fiilen korumasız). Kritik N1
  regresyonu `exam-flow-resolver.test.ts` + route unit testleriyle kilitli; ancak uçtan uca
  (tarayıcı → API → DB) seed'li bir Playwright spec'i (özellikle "ön sınav submit → `/exam/[id]`
  → `/videos`'a iner" senaryosu) takip işi olarak açık.
- **Mobil `videos/progress`:** N2 `clientDuration` tabanı şu an yalnız web `videos/route.ts`'te.
  Mobil route K1 `createdAt` fallback'i aldı ama clientDuration aynası eklenmedi.
