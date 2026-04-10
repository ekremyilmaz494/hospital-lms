# Degisiklik Gunlugu (Changelog)

Bu dosya, Hospital LMS projesindeki onemli degisiklikleri tarihsel sirada listeler.

---

## [1.0.0] - 2026-04-09

### Eklenenler
- 200 demo personel seed verisi ve toplu kullanici olusturma
- Raporlar sayfasina profesyonel PDF ve Excel export ozelligi
- Production hazirlik altyapisi: guvenlik, performans, sertifika ve olceklendirme
- Mobil altyapi, KVKK uyumluluk, egitim wizard, audio player
- Landing sayfasi mobil uyumluluk ve guvenlik denetimi (Hafta 1)
- 28 route icin Cache-Control header desteği
- Performans guard genisletmesi ve responsive tasarim iyilestirmeleri

### Duzeltilener
- PDF Turkce karakter destegi — gsicoü donusumu eklendi
- jspdf-autotable v5 API degisikligi — `doc.autoTable` yerine `autoTable(doc)` kullanimi
- Sinav export — tum personel ilerlemesi ve hata bildirimi duzeltildi
- StaffPage'de eksik `useRouter()` — Vercel build hatasi giderildi
- `proxy.ts` dosyasi `middleware.ts` olarak yeniden adlandirildi (Next.js middleware algilama)
- Personel egitim akisi — 8 tutarsizlik ve UX sorunu duzeltildi
- Auth dongusu cozumu, yedekleme guvenligi, video mobil UX
- Rate limit IP:15 Email:8 — mobilde 2. denemede 429 hatasi duzeltildi
- Sistem sagligi badge, yenile butonu ve takvim event gosterimi
- Login sayfasi orijinal sade tasarima geri donduruld
- Takvim event gosterimi ve Turbopack geri yukleme
- CSP unsafe-inline geri eklendi ve Turbopack kaldirildi
- Sag bosluk sorunu — html+body overflow-x:hidden ve max-width:100vw

### Iyilestirmeler
- Mobil responsive tasarim iyilestirmeleri (tum paneller)
- `getAuthUser()` optimizasyonu: `getUser()` yerine `getSession()` (HTTP round-trip azaltma)
- Dashboard API sorgulari `Promise.all` ile paralellestirme
- Redis cache entegrasyonu (dashboard, profil, bildirimler)
- `useFetch` timeout 8s'den 20s'ye cikarildi
- `optimizePackageImports` ile bundle boyutu kucultme (recharts, lucide-react, framer-motion)
- In-memory auth cache (30s TTL) ile tekrarlanan DB sorgularinin onlenmesi
- Audit log'larda KVKK uyumlu PII redaction
