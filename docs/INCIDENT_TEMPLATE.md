# Olay (Incident) Yönetimi Şablonları

> Son güncelleme: 2026-05-08
> Hedef: Sorun çıktığında müşteriye doğru ve hızlı iletişim kurmak için hazır şablonlar.
> İlişkili: [SLA.md](./SLA.md), [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md)

## Bu doküman ne içindir?

Olay anında doğru kelimeleri bulmaya çalışacak vaktin yok. Bu şablonlarla 5 dakikada müşteriye yazılı bildirim çıkar, telefonda 1 dakikada doğru bilgi verirsin. Kopyala-yapıştır + boşlukları doldur.

---

## Olay Akışı — 5 Aşama

```
1. TESPİT     → Sorun fark edildi (sen veya müşteri)
2. İLK YANIT  → Müşteriye "farkındayız" bildirimi (SLA süresinde)
3. GÜNCELLEME → Çözüm sürerken periyodik durum bildirimi
4. ÇÖZÜM      → Müşteriye "düzeltildi" bildirimi
5. POST-MORTEM → 48 saat içinde yazılı analiz raporu
```

Her aşama için bu doc'ta şablon var.

---

## 1. İlk Yanıt — Müşteriye Bildirim

### P0 — Sistem Tamamen Erişilemez

**Süre hedefi:** Olay alındıktan sonra **1 saat içinde** ilk bildirim.

**Kanal:** Telefon (öncelikli) + e-posta (yazılı kayıt)

#### E-posta Şablonu

```
Konu: [P0 - Acil] Hospital LMS Hizmet Kesintisi — Bildirim

Sayın [Esas Yönetici Adı],

Hospital LMS sisteminde [tespit saati]'da başlayan bir kesinti tespit edildi.
Mevcut durumda sistem [tüm kullanıcılar / belirli bir bölüm için] erişilemez durumda.

ŞU ANKİ BİLGİMİZ:
- Kesinti başlangıcı: [DD.MM.YYYY HH:MM] (Türkiye saati)
- Etkilenen alan: [örn. tüm sisteme giriş / sınav modülü / tek bir hastane]
- Tahmin edilen kullanıcı sayısı: [N]
- Olası kök neden: [sebep henüz net değil / Vercel altyapı arızası / DB bağlantı sorunu / vs]

YAPTIKLARIMIZ:
- Sorunu tespit ettik ve teknik ekip aktif olarak çalışıyor
- [Hangi adımı denediğin: rollback / monitoring / 3rd party iletişimi]

SONRAKİ GÜNCELLEME: [Tahmini saat — 30 dakikadan fazla olmamalı]

İletişim bilgilerim:
[Telefon]
[E-posta]

Saygılarımla,
[Adın]
[Pozisyon]
```

#### Telefon Mesajı (60 saniyelik)

```
"Merhaba [İsim] Bey/Hanım, [şirket adı]'ndan [kendi adın].
Hospital LMS sisteminde [tespit saati] itibarıyla bir sorun yaşıyoruz.
Şu an [genel kapsam, örn. 'tüm kullanıcılar giriş yapamıyor'].
Sebep [en iyi tahmin]. Şu an [yaptığın aksiyon].
[N dakika] içinde size güncel bilgi vereceğim.
Bu sırada müşteri tarafında bir aksiyon almanıza gerek yok / [varsa: müşterilerinize bilgi verin].
Sorularınız için bu numaradan ulaşabilirsiniz."
```

---

### P1 — Önemli Özellik Bozuk

**Süre hedefi:** Olay alındıktan sonra **4 saat içinde** ilk bildirim.

**Kanal:** E-posta

#### E-posta Şablonu

```
Konu: [P1] Hospital LMS — [Etkilenen Özellik] Sorunu Bildirim

Sayın [Esas Yönetici Adı],

Hospital LMS sisteminde [özellik adı]'nde bir sorun tespit edildi.

DURUM:
- Tespit zamanı: [DD.MM.YYYY HH:MM]
- Etkilenen modül: [örn. Sınav, Sertifika, Rapor]
- Etki: [örn. Sınava başlanamıyor / sertifika PDF üretilemiyor]
- Etkilenen kullanıcı: [tüm / sadece X bölümü]

GEÇİCİ ÇÖZÜM (varsa):
- [örn. Şu an için sınav atamaları manuel olarak yönetiliyor]
- [örn. Sertifikalar 24 saat içinde toplu üretilecek]

ÇALIŞMA ZAMAN ÇİZELGESİ:
- Mevcut durum: Sorun tespit edildi, kök neden araştırılıyor
- Hedef çözüm süresi: [SLA gereği 24 saat içinde]
- Bir sonraki güncelleme: [Tarih ve saat]

Saygılarımla,
[Adın]
```

---

### P2 — İkincil Sorun

**Süre hedefi:** Olay alındıktan sonra **24 saat içinde** ilk bildirim.

**Kanal:** E-posta

#### E-posta Şablonu

```
Konu: [P2] Hospital LMS — [Sorun Özeti] Hakkında

Sayın [Esas Yönetici Adı],

Sisteminizdeki [sorun] tespit edilmiş ve sprint planına alınmıştır.

DURUM:
- Etki: [örn. Kullanıcı arayüzünde küçük görsel hata / bildirim e-postaları gecikmeli geliyor]
- İş akışınıza etki: Yok / Minimum
- Geçici çözüm: [Varsa]

PLANLANAN ÇÖZÜM:
- Tahmini düzeltme: [5 iş günü içinde / sonraki sprint]
- Bilgilendirme: Çözüm uygulandığında ayrı bir e-posta gönderilecek

Bu sorunla ilgili soru veya gözleminizi paylaşabilirsiniz.

Saygılarımla,
[Adın]
```

---

## 2. Çözüm Süreci Güncellemesi (Periyodik)

P0 olaylarında her **30 dakikada bir**, P1'de her **2 saatte bir** durum bildirimi gönder.

```
Konu: [Güncelleme #N] Hospital LMS Hizmet Kesintisi

Sayın [Esas Yönetici Adı],

Önceki bildirimimiz hakkında durum güncellemesi:

ŞU ANKİ DURUM:
- [örn. Vercel arızası tespit edildi, kendi tarafımızda yapacağımız bir şey yok]
- [örn. DB bağlantı havuzu yeniden başlatıldı, sistem ayakta]
- [örn. Rollback uygulandı, izleme devam ediyor]

ETKİLENEN KULLANICI:
- Tahmini [%N] erişebiliyor / [%N] hala erişemiyor

SONRAKİ ADIM:
- [örn. Vercel ekibi ile aktif iletişimdeyiz]
- [örn. 15 dakika boyunca sistem stabilitesini izliyoruz]

Bir sonraki güncelleme: [Saat]

Saygılarımla,
[Adın]
```

---

## 3. Çözüm Bildirimi

Olay tamamen çözüldüğünde gönderilir.

```
Konu: [Çözüldü] Hospital LMS Hizmet Kesintisi — [Tarih]

Sayın [Esas Yönetici Adı],

Bugün [HH:MM] itibarıyla başlayan kesinti, [HH:MM]'da tamamen çözülmüştür.

ÖZET:
- Toplam kesinti süresi: [N] dakika
- Sebep: [tek cümle açıklama]
- Etkilenen veri: [Yok / Açıklama]
- Etkilenen işlem: [Yok / Açıklama]

VERİ DURUMU:
- ✅ Veri kaybı yaşanmadı
- ✅ Yedeklerden geri yüklenmesi gerekmedi
- (veya: ⚠️ HH:MM ile HH:MM arası girilen [N] kayıt etkilendi, müşteri tarafından yeniden girilmesi gerekiyor)

DETAYLI ANALİZ:
48 saat içinde tüm kök neden ve önleyici tedbirleri içeren post-mortem raporu paylaşılacaktır.

Yaşadığınız sıkıntı için özür dileriz. Sorularınız için her zaman ulaşabilirsiniz.

Saygılarımla,
[Adın]
```

---

## 4. Post-Mortem Raporu (İç + Dış)

### 4a — İç Post-Mortem (Repo'da kaydedilir)

Dosya: `hospital-lms/docs/incidents/YYYY-MM-DD-<kısa-isim>.md`

```markdown
# [Olay Başlığı]

**Tarih:** YYYY-MM-DD HH:MM (Türkiye saati, UTC+3)
**Tespit eden:** [İsim / Otomatik (Sentry / Health Check)]
**Çözen:** [İsim]
**Süre:** Toplam X dakika kesinti
**Seviye:** P0 / P1 / P2

## Etki Özeti

- **Etkilenen kullanıcı:** [N kullanıcı / Tüm sistem]
- **Etkilenen organizasyon:** [Tek bir org / Tüm orglar]
- **Etkilenen feature:** [örn. Login, Sınav, Sertifika]
- **Veri kaybı:** [Yok / N kayıt / belirtilmesi gereken]
- **SLA ihlali:** [Yok / Var, hangi madde]

## Zaman Çizelgesi

| Zaman | Olay |
|-------|------|
| HH:MM | [İlk belirti — örn. Sentry'de hata akışı başladı] |
| HH:MM | [Tespit — örn. Müşteri telefon etti] |
| HH:MM | [İlk müdahale — örn. Vercel deployment kontrol edildi] |
| HH:MM | [Karar verildi — örn. Rollback uygulanacak] |
| HH:MM | [Aksiyon — örn. Promote previous deployment] |
| HH:MM | [Sistem normalleşti] |
| HH:MM | [Müşteri bilgilendirildi] |

## Kök Neden Analizi (5 Whys)

**1. Niye sistem çöktü?**
[Cevap]

**2. Niye [bu sebep] oluştu?**
[Cevap]

**3. Niye [bu sebep] yakalanmadı önceden?**
[Cevap]

**4. Niye [bu önlem] yoktu?**
[Cevap]

**5. Niye [bu sistemik problem] vardı?**
[Cevap — burada genelde kök sebebe varılır]

## Nasıl Çözüldü

[Hangi senaryo uygulandı (ROLLBACK_RUNBOOK.md'den) — adımlar tek tek]

## Tekrar Etmemesi İçin Aksiyonlar

- [ ] **Aksiyon 1:** [Açıklama] (Sorumlu: ___, Bitiş: YYYY-MM-DD)
- [ ] **Aksiyon 2:** [Açıklama] (Sorumlu: ___, Bitiş: YYYY-MM-DD)
- [ ] **Aksiyon 3:** [Açıklama] (Sorumlu: ___, Bitiş: YYYY-MM-DD)

## Müşteri İletişim Kayıt

- HH:MM — İlk yanıt e-postası gönderildi
- HH:MM — Güncelleme #1 gönderildi
- HH:MM — Çözüm bildirimi gönderildi
- YYYY-MM-DD — Post-mortem raporu (bu doc) müşteriyle paylaşıldı

## Öğrenilen Dersler

[1-3 cümle — bu olaydan ne öğrendik?]

## Ekler

- Sentry issue link: [URL]
- Vercel deployment ID: [ID]
- Slack thread: [URL — varsa]
- Etkilenen audit log entry'leri: [SQL query]
```

### 4b — Dış Post-Mortem (Müşteriye Gönderilir)

```
Konu: [Post-Mortem] Hospital LMS Olayı — YYYY-MM-DD

Sayın [Esas Yönetici Adı],

[Tarih] tarihinde yaşanan kesinti hakkında detaylı analiz raporumuz aşağıdadır.

OLAY ÖZETİ
- Tarih ve saat: [DD.MM.YYYY HH:MM – HH:MM]
- Toplam süre: [N] dakika
- Etki: [açıklama]
- Veri etkisi: [Yok / detaylı açıklama]

KÖK NEDEN
[Müşterinin anlayacağı dilde 1-2 paragraf — teknik jargon en aza indirilir]

YAPILAN MÜDAHALE
[Hangi aksiyonlar alındı — kronolojik]

ALDIĞIMIZ ÖNLEMLER
1. [Öğrendiklerimizden çıkardığımız aksiyon 1 — ne zaman yapılacak]
2. [Aksiyon 2]
3. [Aksiyon 3]

SLA DURUMU
- Bu olay SLA Madde [X.Y] kapsamında değerlendirilmiştir
- Telafi: [Yok / sonraki ay aboneliğinde %N indirim] (varsa)

Yaşadığınız sıkıntı için tekrar özür dileriz. Sistemimizin sürekli iyileşmesi
için bu tip olayları çok ciddiye alıyor, her birinden ders çıkarıyoruz.

Sorularınız için her zaman ulaşabilirsiniz.

Saygılarımla,
[Adın]
[Pozisyon]
```

---

## 5. İç İletişim — Kim Ne Zaman Haberdar Olmalı?

| Olay Seviye | Bildirilecek Kişi | Ne Zaman | Kanal |
|-------------|-------------------|----------|-------|
| P0 | Esas Yönetici (Müşteri) | İlk 1 saat | Telefon + E-posta |
| P0 | Şirket içi yönetim | Anında | Slack / WhatsApp |
| P1 | Esas Yönetici (Müşteri) | İlk 4 saat | E-posta |
| P1 | Şirket içi yönetim | Aynı gün | E-posta |
| P2 | Esas Yönetici (Müşteri) | 24 saat | E-posta |
| P3 | — | Sprint planlama | Backlog |

---

## 6. Olay Sonrası Gözden Geçirme (Aylık)

Her ayın sonunda yapılır:

```
1. Geçen ayın tüm olaylarını listele (docs/incidents/ klasöründen)
2. Toplam kesinti süresi → SLA hedefiyle karşılaştır
3. P0/P1/P2 dağılımı
4. Kök nedenlerde tekrar eden tema var mı?
5. Açık aksiyonlar tamamlandı mı?
6. Hangi alarmlar ekleyebilirdik (önceden yakalansın)?
7. Bir sonraki ayın iyileştirme önceliklerine ekle
```

Çıktı: `docs/incidents/MONTHLY-YYYY-MM.md`

---

## 7. Pratik İpuçları

### Yapılması Gerekenler

- ✅ **Açık ol:** "Bilmiyoruz" demek "yalan söylemekten" daha iyi
- ✅ **Zaman ver:** "X dakika içinde haber vereceğim" — sonra GERÇEKTEN ver
- ✅ **Empati kur:** "Yaşadığınız sıkıntıyı anlıyoruz" — gerçekten anladığını göster
- ✅ **Aksiyon odaklı:** Müşteriye "siz ne yapabilirsiniz" söyle (varsa)
- ✅ **Yazılı kayıt:** Telefonla konuşsan da arkasından e-posta gönder

### Yapılmaması Gerekenler

- ❌ **Üçüncü tarafı suçlama:** "Vercel'in suçu" değil, "Vercel altyapısında bir sorun var ve onlarla iletişimdeyiz"
- ❌ **Tahmini abartma:** "5 dakika içinde" demek yerine "30 dakika içinde değerlendirme yapacağım"
- ❌ **Teknik jargon:** "Connection pool exhausted" yerine "Veritabanı bağlantı limitine ulaşıldı"
- ❌ **Suskun kalma:** Belirsizlik müşteriyi en çok rahatsız eder
- ❌ **Resmi olmayan yerde söz verme:** WhatsApp'tan "şu kadar saat içinde halledeceğim" deme — yazılı SLA çerçevesinde kal

---

## 8. Sık Karşılaşılan Senaryolar İçin Hızlı Yanıtlar

### "Sistem çok yavaş çalışıyor"

```
P1 olarak değerlendiriyoruz. Mevcut sayfa yükleme sürelerimizi inceleyeceğiz.
[Faz 0'da yapılan k6 yük testi sonuçlarına göre] sistemimiz [N] eşzamanlı
kullanıcı için tasarlanmıştır. Sizin tarafınızda anormal yüksek bir kullanım
durumu var mı? 4 saat içinde detaylı analiz dönüşü yapacağız.
```

### "Bir kullanıcı bilgileri yanlış görüyor"

```
P2 — İlgili kullanıcı detaylarını (kullanıcı adı, gördüğü ekran ve gördüğü
yanlış bilgi) bana iletir misiniz? İncelememi takiben size dönüş yapacağım.
[24 saat içinde]
```

### "Sertifika oluşmuyor"

```
P1 — Hangi eğitim için, hangi tarihte sınav tamamlanmış? Personel ID veya
kayıt numarası iletilirse hızlıca incelerim. Manuel oluşturma alternatifimiz
mevcut, gerekirse 30 dakika içinde aktif edebiliriz.
```

### "KVKK kapsamında bir kişinin tüm verisini silmemiz lazım"

```
KVKK Madde 11 kapsamında veri sahibi talebi olarak işlem yapacağım.
Sistemimizde mevcut "Veri Silme Talebi" prosedürü ile 30 gün içinde
tamamlanacaktır. Talep formunu Esas Yönetici panelinden başlatabilir veya
benimle paylaşabilirsiniz.
```

---

## Sonraki Doc

- [SLA.md](./SLA.md) — Hizmet seviyesi taahhütleri (yazılı sözleşme)
- [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) — Sorun çıktığında teknik adımlar
- [disaster-recovery.md](./disaster-recovery.md) — Büyük felaket senaryoları
