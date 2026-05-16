# Klinova Marka Kit

Hem statik SVG logosu hem Remotion animasyonları tek kaynaktan (`tokens.ts`) beslenir.

## Dosya yapısı

```
src/components/brand/         ← React/Next.js için SVG logo
├── tokens.ts                 ← Renkler, gradient'ler, tipografi
├── LogoMark.tsx              ← İşaret (yalnız ikon)
├── Wordmark.tsx              ← Kelime markası (yalnız yazı)
├── Logo.tsx                  ← Bileşik (işaret + yazı)
└── index.ts                  ← Dışa aktarım

src/remotion/klinova/         ← Remotion video kompozisyonları
├── LogoReveal.tsx            ← 5sn logo reveal (1920×1080)
├── SplashScreen.tsx          ← 2sn PWA splash (1080×1920, dikey)
├── IntroVideo.tsx            ← 30sn tanıtım videosu (1920×1080)
├── components/
│   ├── PulseWave.tsx         ← Animasyonlu EKG çizgisi
│   └── NovaStar.tsx          ← Patlayan nova yıldızı
└── index.ts
```

## Next.js'te logo kullanımı

```tsx
import { Logo, LogoMark } from "@/components/brand";

// Ana logo (yatay, gradient)
<Logo size={48} />

// Sadece ikon (favicon, avatar)
<LogoMark size={32} />

// Koyu header için
<Logo size={40} theme="light" />

// Slogan ile dikey
<Logo layout="vertical" tagline="Hastane Eğitim Platformu" />
```

## Remotion studio (canlı önizleme)

```bash
pnpm remotion:studio
```

Tarayıcıda `http://localhost:3000` açılır — tüm kompozisyonlar listelenir.

## Video render komutları

```bash
pnpm brand:reveal        # 5sn logo reveal → public/brand/klinova-reveal.mp4
pnpm brand:splash        # 2sn PWA splash → public/brand/klinova-splash.mp4
pnpm brand:intro         # 30sn tanıtım → public/brand/klinova-intro.mp4
pnpm brand:splash-png    # Splash'ten PNG kare → public/brand/klinova-splash.png
```

Render öncesi `public/brand/` klasörünü oluştur: `mkdir -p public/brand`.

## Marka kuralları

- **Gradient:** `#6366F1` (indigo) → `#06B6D4` (cyan) · 135° açı
- **Koyu zemin:** `#0F172A` (slate-900) — logolara en iyi kontrast
- **Açık zemin:** `#F8FAFC` (slate-50) — beyaz yerine bunu kullan
- **Yasak:** Saf beyaz zeminde gradient logo kullanma — `theme="dark"` (mono) tercih et

## Marka kimliği özeti

- **Ad:** Klinova (Klinik + Nova)
- **Simge:** Nabız çizgisi zirvesinde nova yıldızı — sağlık + yenilik
- **Ton:** Güvenilir + teknoloji-öncü, jenerik SaaS değil

## Özelleştirme ipuçları

- `tokens.ts` dışındaki dosyalarda ham renk kodu kullanma
- Yeni animasyon eklerken `src/remotion/Root.tsx`'e `<Composition>` kaydı ekle
- IntroVideo senaryosunu `IntroVideo.tsx` içindeki `SCENE_SCRIPT` sabitinde düzenle
