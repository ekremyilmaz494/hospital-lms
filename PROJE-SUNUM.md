# Hospital LMS — Proje Tanıtım ve Analiz Dokümanı

> Türkiye'deki hastanelerin personel eğitim sürecini baştan sona dijitalleştiren, sektöre özel, production-ready bir SaaS platformu.

---

## Bu Proje Ne?

Hospital LMS, hastanelerin en büyük operasyonel sorunlarından birini çözüyor: **personel eğitim yönetimi**.

Türkiye'deki hastaneler JCI ve SKS akreditasyonu için personellerinin belirli eğitimleri tamamladığını belgelemek zorunda. Çoğu hastane bunu hâlâ Excel tablolarıyla yapıyor. Eğitim atandı mı, personel izledi mi, sınavı geçti mi, sertifikası var mı — hepsi manuel takip ediliyor. Bir akreditasyon denetimi geldiğinde haftalarca geriye dönük evrak hazırlanıyor.

Hospital LMS bu süreci tamamen dijitalleştiriyor: eğitim oluştur, video/PDF yükle, personele ata, sınavı al, sertifikayı otomatik oluştur, uyum raporunu tek tıkla çıkar.

---

## Projenin Ölçeği

Bu bir todo app ya da basit bir CRUD projesi değil. Rakamlarla:

- **65 frontend sayfası** (32 admin, 11 personel, 11 super admin, 5 sınav, 6 auth)
- **170+ API endpoint** (CRUD, raporlama, export, cron, webhook)
- **43 veritabanı modeli** (Prisma ORM ile)
- **88+ veritabanı indexi** (performans optimizasyonu)
- **42 tablo üzerinde Row Level Security** (veri izolasyonu)
- **3 ayrı kullanıcı paneli** + tam ekran sınav modülü
- **10+ Türkçe e-posta şablonu**
- **5 otomatik cron job** (günlük yedekleme, temizlik, hatırlatma)
- **8 E2E test senaryosu** + 10+ unit test dosyası

---

## Tech Stack

| Katman | Teknoloji | Neden Seçildi |
|--------|-----------|---------------|
| Frontend | **Next.js 16 + React 19 + TypeScript** | En güncel, SSR + App Router, type-safe |
| UI | **Tailwind CSS 4 + shadcn/ui** | Hızlı geliştirme, tutarlı tasarım |
| Veritabanı | **Supabase PostgreSQL + Prisma 7** | Managed DB, RLS desteği, realtime |
| Auth | **Supabase Auth** | JWT, MFA, SSO/SAML/OIDC desteği |
| Video | **AWS S3 + CloudFront CDN** | Güvenli streaming, presigned URL |
| Cache | **Upstash Redis** | Sınav zamanlayıcı, rate limiting, dashboard cache |
| Deployment | **Vercel (Frankfurt)** | Auto-scaling, edge network, cron jobs |
| Monitoring | **Sentry** | Hata takibi, performans izleme |
| E-posta | **Nodemailer (SMTP)** | Türkçe şablonlar, rate limiting |
| Ödeme | **Iyzico** | Türk ödeme altyapısı |

---

## Mimari

```
Kullanıcı (Tarayıcı / PWA)
        │
        ▼
   ┌─────────────────────────┐
   │      Vercel CDN          │  Frankfurt region
   │   (Next.js 16 App)       │  Auto-scaling
   └────────┬────────────────┘
            │
    ┌───────┼───────────────────────┐
    │       │                       │
    ▼       ▼                       ▼
┌────────┐ ┌──────────────┐  ┌───────────┐
│Supabase│ │  AWS S3 +    │  │  Upstash  │
│  Auth  │ │  CloudFront  │  │   Redis   │
│  RLS   │ │  (Video CDN) │  │  (Cache)  │
│Realtime│ └──────────────┘  └───────────┘
│PostgreSQL│
└────────┘
```

**Multi-tenant izolasyon**: Her hastane kendi subdomain'inde çalışır (ornek.hospitallms.com). Veritabanı seviyesinde Row Level Security ile bir hastanenin verisi başka bir hastane tarafından kesinlikle görülemez. Tek codebase, sınırsız hastane.

---

## Sayfalar ve Ne İşe Yararlar

### Herkese Açık Sayfalar

**Ana Sayfa** (`/`) — Platformun vitrini. Hero section, özellikler, istatistikler, müşteri yorumları ve CTA butonları ile ziyaretçileri kayıt olmaya yönlendiriyor. Modern bir SaaS landing page tasarımı.

**Fiyatlandırma** (`/pricing`) — Abonelik planlarını karşılaştırmalı olarak gösteriyor. Ücretsiz deneme, başlangıç, profesyonel ve kurumsal plan seçenekleri. Her planın hangi özellikleri içerdiği net bir şekilde görülüyor.

**Kayıt Ol** (`/register`) — Bir hastane yöneticisi buradan self-servis kayıt yapabiliyor. Hastane adı, departman bilgileri, admin hesabı oluşturma — hepsi tek formda. Kayıt sonrası otomatik kurulum sihirbazı başlıyor.

**Demo Talep** (`/demo`) — Demo görmek isteyen hastaneler için randevu formu.

**İletişim** (`/contact`) — Doğrudan iletişim formu.

**Yasal Sayfalar** (`/privacy`, `/terms`, `/data-retention`, `/kvkk`) — KVKK uyumluluğu için gerekli yasal metinler. Veri saklama süreleri, kişisel verilerin korunması politikası.

**Sertifika Doğrulama** (`/certificates/verify/[code]`) — Herhangi biri bir sertifikanın QR kodunu okuttuğunda bu sayfaya yönlendiriliyor. Sertifikanın gerçekliği, kimin aldığı, hangi eğitim için verildiği doğrulanıyor. Bu özellik akreditasyon denetimleri için çok değerli.

---

### Kimlik Doğrulama

**Giriş** (`/auth/login`) — E-posta + şifre ile giriş. Eğer hastane SSO kullanıyorsa, tek tıkla kurumsal hesapla giriş yapılabiliyor. MFA aktifse, giriş sonrası doğrulama kodu isteniyor.

**MFA Kurulumu** (`/auth/mfa-setup`) — Google Authenticator veya benzeri bir uygulama ile iki faktörlü doğrulama aktif ediliyor. QR kod tarama + doğrulama kodu girişi.

**Şifre İşlemleri** (`/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`) — Tam bir şifre yönetim akışı. E-posta ile sıfırlama linki, güvenli token doğrulama.

---

### Admin Paneli (Hastane Yöneticisi)

Bu panel, bir hastanenin eğitim müdürü veya kalite sorumlusunun kullandığı ana çalışma alanı. 27 sayfa içeriyor.

**Dashboard** (`/admin/dashboard`) — Hastanenin eğitim durumunun kuşbakışı görünümü. Toplam personel, aktif eğitim sayısı, tamamlanma oranı, ortalama sınav puanı, yaklaşan son tarihler — hepsi tek ekranda. Trend grafikleri ile geçen aya göre durumu gösteriyor. Son aktiviteler akışı ile kimin ne tamamladığı anlık görülüyor.

Teknik detay: Dashboard verileri Redis ile 5 dakika cache'leniyor. 6 bağımsız veritabanı sorgusu `Promise.all()` ile paralel çalıştırılıyor — ilk yüklemede ~2 saniye, cache'den <100ms.

**Eğitim Yönetimi** (`/admin/trainings`, `/admin/trainings/new`, `/admin/trainings/[id]`) — Eğitim oluşturma 4 adımlı bir sihirbazla yapılıyor:

1. **Temel Bilgiler**: Başlık, açıklama, kategori, geçme notu, maksimum deneme hakkı
2. **İçerik Yükleme**: Video, PDF veya ses dosyası yükleme. Videolar AWS S3'e presigned URL ile yükleniyor, ardından CloudFront CDN üzerinden stream ediliyor.
3. **Sınav Soruları**: Çoktan seçmeli sorular oluşturma. Soru bankasından mevcut soruları çekme imkanı.
4. **Atama**: Tekil personele veya departman bazında toplu atama. Bir departmana atandığında o departmandaki herkes otomatik olarak eğitimi görüyor.

Eğitim listesinde filtreleme (duruma göre, kategoriye göre), arama ve sayfalama var. Her eğitimin tamamlanma istatistikleri anlık görülüyor.

**Sınav Yönetimi** (`/admin/exams`, `/admin/exams/question-bank`) — Eğitimden bağımsız sınavlar oluşturma ve soru bankası yönetimi. Soru bankası özelliği sayesinde bir kez oluşturulan sorular birden fazla sınav ve eğitimde tekrar kullanılabiliyor. Sınav sonuçları sayfasında (`/admin/exams/[id]/results`) ortalama puan, başarı oranı ve soru bazlı analiz var.

**Personel Yönetimi** (`/admin/staff`) — Hastanedeki tüm personelin listesi. Departman, rol, eğitim tamamlanma durumu görülüyor. Excel ile toplu kullanıcı import edebilme özelliği var. Her personelin detay sayfasında (`/admin/staff/[id]`) tamamladığı eğitimler, sertifikaları, sınav geçmişi ve performans trendi var.

**Sertifika Yönetimi** (`/admin/certificates`) — Verilen tüm sertifikaların listesi. Her sertifika PDF olarak indirilebilir, QR kod ile doğrulanabilir. Sertifikalar eğitim tamamlandığında ve sınav geçildiğinde otomatik oluşturuluyor.

**Uyum Raporu** (`/admin/compliance`) — Akreditasyon için en kritik sayfa. Zorunlu eğitimlerin personel bazında tamamlanma durumu. "Kimler eksik?", "Son tarihe kaç gün kaldı?", "Hangi departman geride?" — tüm bu soruların cevabı burada. JCI veya SKS denetimi öncesinde bu rapor hayat kurtarıyor.

**Yetkinlik Matrisi** (`/admin/competency-matrix`) — Personel değerlendirme sistemi. Yönetici, personelin yetkinliklerini (iletişim, teknik beceri, hasta güvenliği vb.) form doldurar değerlendiriyor. Sonuçlar matris görünümünde departman bazında görülebiliyor.

**Eğitim Etkililik Analizi** (`/admin/effectiveness`) — Eğitimlerin gerçekten işe yarayıp yaramadığını ölçen raporlar. Sınav öncesi/sonrası karşılaştırma, departman bazında performans değişimi.

**İçerik Kütüphanesi** (`/admin/content-library`) — Platform genelinde paylaşılan eğitim şablonları. Super admin'in yayınladığı hazır eğitimleri tek tıkla kendi hastanesine kurabilir. Bu sayede her hastane sıfırdan eğitim oluşturmak zorunda kalmıyor.

**AI İçerik Stüdyosu** (`/admin/ai-content-studio`) — Yapay zeka ile eğitim içeriği üretme. Bir belge (PDF, doküman) yükleyip "bunu eğitime çevir" diyebilirsin. AI otomatik olarak eğitim başlığı, açıklaması ve sınav soruları oluşturuyor. Yönetici inceleyip onaylıyor veya düzenliyor. (Beta aşamasında)

**SMG Takibi** (`/admin/smg`) — Sağlık Bakanlığı'nın zorunlu kıldığı Sürekli Mesleki Gelişim (SMG) puanlarının takibi. Her eğitim belirli SMG puanı kazandırıyor. Personelin yıllık SMG puan durumu takip ediliyor.

**Raporlar** (`/admin/reports`) — Detaylı analitik raporlar. Eğitim bazında, personel bazında, departman bazında filtrelenebilir. Excel ve PDF formatında export edilebilir. Bakanlık raporlama formatında da çıktı alınabiliyor.

**Bildirimler** (`/admin/notifications`) — Toplu bildirim gönderme arayüzü. Tüm personele, belirli bir departmana veya seçili kişilere bildirim gönder. Geçmiş bildirimler ve okunma durumu.

**Denetim Kayıtları** (`/admin/audit-logs`) — Kim, ne zaman, ne yaptı — her işlemin kaydı. Bir personel silindi mi, bir eğitim değiştirildi mi, bir sınav sonucu sıfırlandı mı? Hepsi burada. KVKK ve akreditasyon denetimleri için zorunlu.

**Akreditasyon** (`/admin/accreditation`) — JCI/SKS akreditasyon sürecini takip eden modül. Hangi standartlar karşılandı, hangileri eksik, raporlama.

**Yedeklemeler** (`/admin/backups`) — Veritabanı yedekleme geçmişi. Otomatik günlük yedekleme çalışıyor (Vercel cron), ayrıca manuel yedekleme tetiklenebilir. Yedekler şifreli olarak saklanıyor.

**Ayarlar** (`/admin/settings`) — Hastane genel ayarları (isim, logo, oturum zaman aşımı süresi), eğitim kategorileri yönetimi ve HBYS entegrasyon ayarları.

**Kurulum Sihirbazı** (`/admin/setup`) — İlk kayıt sonrası adım adım kurulum. Departmanları oluştur, temel ayarları yap, ilk eğitimini oluştur. Yeni hastanelerin hızlıca başlamasını sağlıyor.

---

### Personel Paneli

Bu panel, hastanede çalışan doktor, hemşire veya diğer sağlık personelinin kullandığı arayüz. Sade ve odaklanmış — sadece kendi eğitimleri, sertifikaları ve bildirimleri var.

**Dashboard** (`/staff/dashboard`) — Kişisel eğitim durumu. Kaç eğitim tamamlandı, kaçı bekliyor, ortalama puan. Son aktiviteler.

**Eğitimlerim** (`/staff/my-trainings`) — Atanan eğitimlerin listesi. Her birinin durumu net: "Bekliyor", "Devam Ediyor", "Tamamlandı" veya "Başarısız". Bir eğitime tıklayınca (`/staff/my-trainings/[id]`) videoları izleme, sınava girme ve sonucu görme akışı başlıyor.

**Sertifikalarım** (`/staff/certificates`) — Kazanılan sertifikaların listesi. Her biri PDF olarak indirilebilir.

**Takvim** (`/staff/calendar`) — Eğitim takvimi. Son teslim tarihleri ve planlanan eğitimler takvim görünümünde.

**Bildirimler** (`/staff/notifications`) — Yeni eğitim atamaları, sınav sonuçları, hatırlatmalar. Gerçek zamanlı (WebSocket) bildirim — sayfa yenilemeden anında geliyor.

**Profilim** (`/staff/profile`) — Kişisel bilgiler ve hesap ayarları.

**SMG Puanlarım** (`/staff/smg`) — Kişisel SMG puan takibi. Yıl içinde kazandığı puanlar ve hedef.

**KVKK Taleplerim** (`/staff/kvkk`) — Kişisel verileriyle ilgili silme veya düzeltme talebi oluşturma formu. KVKK yasası gereği her çalışanın bu hakka sahip olması gerekiyor.

---

### Super Admin Paneli (Platform Yöneticisi)

Bu panel, SaaS platformunun sahibi olarak tüm hastaneleri yönetmek için kullanılıyor. Sadece biz erişebiliyoruz.

**Dashboard** (`/super-admin/dashboard`) — Platform geneli kuşbakışı. Toplam hastane sayısı, toplam kullanıcı, aktif abonelikler, gelir grafikleri.

**Hastane Yönetimi** (`/super-admin/hospitals`) — Kayıtlı tüm hastanelerin listesi. Hastane detaylarını görebilme, planını değiştirebilme, gerekirse askıya alma. Yeni hastane oluşturma (`/super-admin/hospitals/new`).

**Abonelik Yönetimi** (`/super-admin/subscriptions`) — Abonelik planlarını yönetme — fiyat, özellik limitleri, deneme süresi.

**İçerik Kütüphanesi** (`/super-admin/content-library`) — Tüm hastanelerin erişebileceği hazır eğitim şablonları yayınlama.

**Raporlar & Denetim** (`/super-admin/reports`, `/super-admin/audit-logs`) — Platformlar arası raporlar ve denetim kayıtları.

**Sistem Sağlığı** (`/super-admin/system-health`) — Sunucu durumu, veritabanı bağlantısı, cache durumu, hata oranları.

**Impersonation** — Herhangi bir hastane yöneticisinin hesabına geçici olarak giriş yapabilme. Müşteri destek için kritik.

---

### Sınav Modülü (Tam Ekran)

Sınav modülü diğer panellerden tamamen ayrı çalışıyor. Sidebar yok, navigasyon yok — tam ekran, odaklanmış bir sınav deneyimi.

**Sınav Öncesi** (`/exam/[id]/pre-exam`) — Sınav başlamadan önce talimatlar ekranı. Süre, soru sayısı, geçme notu, kurallar. "Sınava Başla" butonuyla zamanlayıcı başlıyor.

**Video İzleme** (`/exam/[id]/videos`) — Eğitim videolarını izleme ekranı. Kritik özellik: **ileri sarma engelli**. Personel videoyu gerçekten izlemek zorunda — atlayamaz. İzleme süresi saniye bazında takip ediliyor. Video, CloudFront CDN üzerinden signed URL ile stream ediliyor.

**Geçiş Ekranı** (`/exam/[id]/transition`) — Birden fazla video varsa aralarındaki geçiş. Gerekiyorsa bekleme süresi.

**SCORM İçerikleri** (`/exam/[id]/scorm`) — SCORM paket formatındaki eğitim içerikleri için gömülü player.

**Sınav Sonrası** (`/exam/[id]/post-exam`) — Sonuç ekranı. Puan, başarı/başarısızlık durumu. Başarılıysa dijital imza ile sertifika onaylama.

**Sınav Motorunun Teknik Detayları:**
- Zamanlayıcı Redis üzerinde çalışıyor (sunucu taraflı — tarayıcı saati ile oynamak hile yapılmasını engellemiyor)
- Sorular her denemede farklı sırada karıştırılabiliyor
- Her cevap anlık olarak sunucuya kaydediliyor (tarayıcı kapansa bile ilerleme kaybolmuyor)
- Maksimum deneme hakkı ayarlanabiliyor
- Otomatik puanlama ve geçme notu kontrolü

---

## Türkiye'deki LMS'lerle Karşılaştırma

### Piyasada Ne Var?

Türkiye'de hastane eğitim yönetimi için **sektöre özel bir dijital çözüm neredeyse yok**. Mevcut durum:

**Çoğu hastane Excel ile takip yapıyor.** Eğitim atandı mı? Excel'e yaz. Personel tamamladı mı? Excel'i güncelle. Akreditasyon denetimi mi geldi? Haftalarca geriye dönük evrak hazırla. Bu süreç hem zaman kaybettiriyor hem hata oranı yüksek.

**Genel amaçlı LMS'ler var ama hastaneye uymuyor:**

**Vedubox** — Türkiye'nin en bilinen online eğitim platformu. Kurumsal eğitim çözümleri sunuyor ama tamamen genel amaçlı. Hastaneye özel hiçbir modülü yok: SMG takibi yok, HBYS entegrasyonu yok, JCI/SKS raporları yok, zorunlu eğitim uyum takibi yok. Bir hastane Vedubox kullanırsa, uyum raporlarını yine Excel'de tutmak zorunda.

**Moodle** — Açık kaynaklı, ücretsiz ama self-hosted. Kurulum, bakım, güncelleme hep hastanenin sorumluluğunda. Sunucu maliyeti, IT ekibi gereksinimi ve sağlık sektörüne özel hiçbir özelliğin olmaması büyük dezavantaj.

**Uluslararası çözümler (HealthStream, Relias)** — Bunlar ABD/Avrupa odaklı. Fiyatları $10-25/kullanıcı/ay (500 personelli bir hastane için aylık $5,000-12,500). Türkçe desteği yok, KVKK uyumsuz, SMG puan sistemi yok, Türkiye mevzuatına uygun raporlama yok.

### Hospital LMS Ne Fark Yaratıyor?

**Sektöre özel tasarım.** Bu genel bir LMS değil — hastane iş akışları düşünülerek tasarlandı. Zorunlu eğitim uyum takibi, akreditasyon raporları, yetkinlik matrisi, SMG puanları — bunlar hastaneye özel modüller ve hiçbir rakipte yok.

**KVKK uyumluluğu yerleşik.** Veri silme talepleri, denetim logları, onay takibi — KVKK gereksinimleri sonradan eklenmedi, baştan tasarlandı. Uluslararası çözümlerin GDPR uyumu var ama KVKK farklı gereksinimler içeriyor.

**Türkçe, baştan sona.** Arayüz, e-posta şablonları, hata mesajları, raporlar — hepsi Türkçe. PDF export'ta Türkçe karakter sorunu yok (özel HTML2Canvas + jsPDF çözümü).

**HBYS entegrasyonu.** Hastane Bilgi Yönetim Sistemi ile webhook tabanlı entegrasyon. Personel listesi otomatik senkronize edilebiliyor.

**Fiyat avantajı.** Yerel pazara uygun fiyatlandırma. Uluslararası çözümlerin onda biri maliyetle aynı (hatta daha fazla) özellik.

---

## Projenin Güçlü Yönleri

### 1. Bu Gerçek Bir Sorun Çözüyor
Hastaneler akreditasyon için eğitim belgelemeye **mecbur**. Bu zorunluluk var oldukça bu platforma ihtiyaç var. Pazar büyüklüğü: Türkiye'de ~2,000 hastane, her birinde yüzlerce personel.

### 2. Multi-Tenant SaaS Mimarisi
Tek codebase ile sınırsız hastane. Her hastane kendi subdomain'inde izole çalışıyor. Veritabanı seviyesinde Row Level Security — bir hastanenin verisi kesinlikle başka bir hastaneden görülemiyor. Bu mimari, bir startup'ın ölçeklenmesi için ideal.

### 3. Video Altyapısı Profesyonel Seviyede
Videolar direkt S3'e yükleniyor, CloudFront CDN üzerinden signed URL ile stream ediliyor. İleri sarma engelli player, saniye bazında izleme takibi. Bu bir YouTube embed değil — gerçek bir eğitim video altyapısı.

### 4. Sınav Motoru Hile Yapılmaya Dayanıklı
Zamanlayıcı Redis üzerinde sunucu tarafında çalışıyor. Tarayıcı saatini ileri almak veya sayfayı yenilemek hiçbir şeyi değiştirmiyor. Sorular her denemede karıştırılıyor. Cevaplar anlık kaydediliyor.

### 5. Güvenlik Ciddiye Alınmış
MFA, SSO, 42 tabloda RLS, rate limiting, audit logging, şifreli yedekleme, KVKK uyumu, CSP headers, pre-commit secret scanner — bu seviyede güvenlik çoğu startup'ta yok.

### 6. Production-Ready
Kapsamlı bir audit yapıldı. 65 sayfa, 170 API, 43 model tek tek incelendi. %92 production-ready durumda. Vercel cron'ları çalışıyor, Sentry monitoring aktif, otomatik yedekleme var.

---

## Geri Bildirim İçin Sorulabilecek Sorular

Bu projeyi birine gösterdiğinde, şu sorularla yönlendirebilirsin:

1. **Mimari hakkında:** "Next.js + Supabase + Redis stack'i bu tür bir SaaS için doğru seçim mi? Alternatif ne olabilirdi?"

2. **Multi-tenant strateji hakkında:** "Subdomain bazlı izolasyon + RLS yeterli mi? Şirket büyüdükçe ne tür ölçekleme sorunları çıkabilir?"

3. **Video altyapısı hakkında:** "S3 + CloudFront maliyet/performans açısından optimal mi? Daha iyi bir yaklaşım var mı?"

4. **Sınav motoru hakkında:** "Redis bazlı zamanlayıcı ve sunucu taraflı soru karıştırma yaklaşımı hakkında ne düşünüyorsun?"

5. **Kullanıcı deneyimi hakkında:** "65 sayfalık bir SaaS'ta UX tutarlılığını nasıl iyileştirebilirim? Hangi akışlar sadeleştirilebilir?"

6. **Ölçekleme hakkında:** "İlk 10 hastane için yeterli mi? 100 hastaneye çıktığında ne değişmeli?"

7. **Fiyatlandırma hakkında:** "Bu ölçekte bir SaaS'ı Türkiye'de nasıl fiyatlandırmalıyım?"

8. **Eksikler hakkında:** "Bir hastane IT müdürü bu ürünü gördüğünde ilk ne sorar? Hangi özellikler kesinlikle olmalı?"

9. **Test stratejisi hakkında:** "Bu ölçekte bir proje için test coverage nasıl olmalı? Nelere öncelik vermeliyim?"

10. **Genel izlenim:** "Bu projenin en güçlü ve en zayıf yönleri neler? Ne değiştirirdin?"

---

## Son Söz

Hospital LMS, Türkiye'deki hastane eğitim yönetimi pazarında ciddi bir boşluğu dolduruyor. Sektöre özel, Türkçe, KVKK uyumlu, modern tech stack üzerine kurulu ve production-ready bir SaaS platformu. Rakip analizi gösteriyor ki bu segmentte doğrudan bir alternatif yok — ne yerli ne yabancı çözümler bu kadar spesifik bir soruna bu kadar kapsamlı bir çözüm sunmuyor.

Proje 65 sayfa, 170+ API endpoint ve 43 veritabanı modeli ile enterprise-grade bir ölçekte. Güvenlik, performans optimizasyonu ve uyumluluk (KVKK, JCI, SKS) konularında ciddi yatırım yapılmış durumda.
