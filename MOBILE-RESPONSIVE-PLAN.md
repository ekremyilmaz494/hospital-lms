# Personel Paneli Mobil Uyumluluk Planı

## Bağlam

Personel paneli 11 sayfadan oluşuyor. Temel mobil altyapı mevcut (MobileBottomNav, sidebar gizleme, responsive padding) ancak:
- Bottom nav sadece 4 sayfa gösteriyor → Takvim, Bildirimler, Değerlendirmeler, SMG, KVKK mobilde **erişilemez**
- `grid-cols-4` gibi hardcoded grid'ler mobilde taşıyor
- Touch target'lar 40px (WCAG min. 44px)
- Responsive tipografi yok
- Duplicate `useMobileView` hook'ları var

---

## Faz 1: Altyapı (Foundation)

### 1.1 — Merkezi `useMobile` hook oluştur
**Yeni dosya:** `src/hooks/use-mobile.ts`

Şu anda iki ayrı yerde duplicate implementasyon var:
- `src/components/shared/data-table.tsx` satır 39: `useMobileView()` — `window.matchMedia('(max-width: 767px)')`
- `src/app/staff/layout.tsx` satır 25-34: inline `useEffect` — `window.innerWidth >= 768`

Yapılacak:
- `matchMedia('(max-width: 767px)')` ile SSR-safe boolean hook oluştur
- `data-table.tsx` içindeki `useMobileView()` bu hook'u kullanacak şekilde refactor et
- `staff/layout.tsx` içindeki inline implementasyonu bu hook ile değiştir

```tsx
// src/hooks/use-mobile.ts
"use client";
import { useState, useEffect } from "react";

export function useMobile(breakpoint = 767): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
```

### 1.2 — Mobil Sidebar Drawer oluştur
**Yeni dosya:** `src/components/layouts/mobile-sidebar-drawer.tsx`

Bu en kritik altyapı parçası. Şu anda Takvim, Bildirimler, Değerlendirmeler, SMG ve KVKK sayfaları mobilde tamamen erişilemez durumda.

Tasarım:
- Mevcut `Sheet` component'ini (`src/components/ui/sheet.tsx`) `side="left"` ile kullan — sıfır yeni bağımlılık
- `sidebar-config.ts`'den staff nav item'larını al ve tamamını göster (8 item, 2 grup)
- Üstte org logosu + org adı
- Altta kullanıcı avatarı + ad + çıkış butonu
- Mevcut `app-sidebar.tsx`'in expanded görünümüne benzer tasarım
- Herhangi bir link'e tıklanınca drawer otomatik kapansın
- Props: `open`, `onClose`, `navGroups`, org branding, user info

### 1.3 — Staff Layout güncelle
**Dosya:** `src/app/staff/layout.tsx`

Değişiklikler:
- `const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)` ekle
- AppTopbar'a `onToggleSidebar={() => setMobileDrawerOpen(true)}` geç (mevcut `toggleSidebar` mobilde işe yaramıyor çünkü sidebar zaten gizli)
- `<MobileSidebarDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} ... />` render et
- Inline `isMd` state'i `useMobile()` hook ile değiştir

### 1.4 — MobileBottomNav güncelle
**Dosya:** `src/components/layouts/mobile-bottom-nav.tsx`

Değişiklikler:
- 4. item (Profil) → "Daha Fazla" (Menu ikonu) olarak değiştir
- Tıklandığında sidebar drawer'ı açar
- Yeni prop: `onMorePress: () => void`
- Staff layout'tan `onMorePress={() => setMobileDrawerOpen(true)}` geçilecek
- Profil sayfası hala drawer + topbar avatar dropdown üzerinden erişilebilir

> **Neden "Daha Fazla"?** iOS tab bar convention. 320px'de 5+ item sığmaz, bu pattern en yaygın mobil UX çözümüdür.

---

## Faz 2: Sayfa Bazlı Responsive Düzeltmeler

### 2.1 — Eğitimlerim (KRİTİK BUG)
**Dosya:** `src/app/staff/my-trainings/page.tsx`

| Sorun | Satır | Çözüm |
|-------|-------|-------|
| `grid-cols-4` hardcoded (stat kartları) | ~146 | `grid-cols-2 sm:grid-cols-4` |
| Aktif eğitim kartı `flex` taşıyor | ~224 | `flex-col sm:flex-row`, padding `p-4 sm:p-6` |
| Metadata satırı taşıyor | ~249 | `flex-wrap gap-2 sm:gap-5` |
| CTA buton genişliği | — | `w-full sm:w-auto` |
| Header margin | — | `mb-5 sm:mb-8` |

### 2.2 — Takvim (KRİTİK BUG + KARMAŞIK)
**Dosya:** `src/app/staff/calendar/page.tsx`

| Sorun | Satır | Çözüm |
|-------|-------|-------|
| `grid-cols-4` hardcoded (stat satırı) | ~241 | `grid-cols-2 sm:grid-cols-4` |
| Hücre min-height büyük | — | `min-h-[60px] sm:min-h-[80px]` |
| Event pill'ler 42px hücrede okunamaz | — | Mobilde renkli dot göster, metin gizle |
| Ay navigasyon butonları küçük | — | `h-11 w-11 sm:h-9 sm:w-9` (44px touch) |
| Gün tıklama detay paneli | — | `grid-cols-1 lg:grid-cols-[1fr_320px]` (zaten stack) |

### 2.3 — Dashboard
**Dosya:** `src/app/staff/dashboard/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Karşılama metni `text-2xl` sabit | `text-xl sm:text-2xl` |
| Countdown widget rakam kutuları | Mobilde küçült: `text-[16px] sm:text-[20px]` |
| Eğitim listesi badge'leri taşıyor | `flex-wrap` ekle |

### 2.4 — Profil
**Dosya:** `src/app/staff/profile/page.tsx`

| Sorun | Satır | Çözüm |
|-------|-------|-------|
| Ad/Soyad grid `grid-cols-2` | ~438 | `grid-cols-1 sm:grid-cols-2` |
| Şifre grid `grid-cols-2` | ~553 | `grid-cols-1 sm:grid-cols-2` |
| Kart header flex taşıyor | ~411 | `flex-col gap-3 sm:flex-row sm:items-center` |
| Kaydet butonu | — | Mobilde `w-full` |

### 2.5 — SMG Puanları
**Dosya:** `src/app/staff/smg/page.tsx`

| Sorun | Satır | Çözüm |
|-------|-------|-------|
| Header satırı taşıyor | ~127-148 | `flex-col gap-3 sm:flex-row sm:items-center` |
| Dönem seçici + buton | — | Mobilde ikinci satıra, buton `w-full` |

### 2.6 — Eğitim Detay
**Dosya:** `src/app/staff/my-trainings/[id]/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Step progress yatay taşıyor | Mobilde dikey layout |
| CTA buton | `w-full sm:w-auto` |
| Geri ok küçük | Min 44px touch target |

### 2.7 — Sertifikalar
**Dosya:** `src/app/staff/certificates/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Kart grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| İndirme/kopyala butonları | 44px touch target |

### 2.8 — Bildirimler
**Dosya:** `src/app/staff/notifications/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Filtre butonları taşıyor | `flex-wrap` ekle |
| "Tümünü okundu" | Yeterli touch target doğrula |
| Bildirim öğeleri | 44px min yükseklik |

### 2.9 — Değerlendirmeler
**Dosya:** `src/app/staff/evaluations/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Kart listesi | Mobilde full-width doğrula |
| CTA butonları | 44px touch target |

### 2.10 — Değerlendirme Detay
**Dosya:** `src/app/staff/evaluations/[id]/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Yıldız ikonları `h-8 w-8` (32px) | `h-10 w-10 sm:h-8 sm:w-8` (44px mobil) |
| Önceki/Sonraki butonları | Mobilde `w-full` |

### 2.11 — KVKK
**Dosya:** `src/app/staff/kvkk/page.tsx`

| Sorun | Çözüm |
|-------|-------|
| Talep kartları | Full-width |
| Form alanları | Full-width |
| Gönder butonu | 44px touch target |

---

## Faz 3: Tipografi ve Touch Target Genel Tarama

### Responsive Tipografi Standardı
- Sayfa başlıkları: `text-lg sm:text-xl`
- Bölüm başlıkları: `text-sm sm:text-base font-bold`
- Bunu Dashboard, My Trainings, Calendar, Profile, Certificates sayfalarındaki özel header'lara uygula

### Touch Target Pattern
Tüm interaktif elementler minimum 44x44px olmalı:
- İkon butonlar: `h-11 w-11 sm:h-9 sm:w-9`
- Liste öğeleri: minimum 44px yükseklik
- Calendar hücreleri: yeterli padding

---

## Faz 4: Doğrulama (Verification)

### Manuel Test Checklist
Her 11 sayfa için şunları test et:
- [ ] 320px genişlik (iPhone SE) — tüm içerik görünür, yatay scroll yok
- [ ] 375px genişlik (iPhone 12/13/14) — düzgün layout
- [ ] 768px genişlik (breakpoint sınırı) — desktop layout aktif
- [ ] Tüm nav item'ları drawer'dan erişilebilir
- [ ] Touch target'lar >= 44px
- [ ] Bottom nav "Daha Fazla" butonu drawer açıyor

### Otomatik Doğrulama
```bash
pnpm tsc --noEmit   # TypeScript hata kontrolü
pnpm lint            # Lint kontrolü
pnpm build           # Production build
```

---

## Uygulama Sırası

1. **Faz 1** — Tüm sayfalar buna bağlı, önce tamamlanmalı
2. **Faz 2** — Öncelik sırasıyla:
   1. Eğitimlerim (kritik bug)
   2. Takvim (kritik bug)
   3. Dashboard
   4. Profil
   5. SMG Puanları
   6. Eğitim Detay
   7. Sertifikalar
   8. Bildirimler
   9. Değerlendirmeler
   10. Değerlendirme Detay
   11. KVKK
3. **Faz 3** — Final tarama
4. **Faz 4** — Test ve doğrulama

---

## Mimari Kararlar Özeti

| Karar | Gerekçe |
|-------|---------|
| Sheet-based drawer | Mevcut `@base-ui/react` Sheet — sıfır yeni bağımlılık |
| "Daha Fazla" butonu bottom nav'da | iOS tab bar convention, 320px'de 5+ item sığmaz |
| Merkezi `useMobile` hook | 2 duplicate implementasyonu birleştirir |
| Mobilde event dot (takvim) | 42px hücrede metin okunamaz, dot + tap-to-reveal |
| Desktop layout değişmez | Sadece `md:` breakpoint altında değişiklik |

---

## Kritik Dosyalar

### Yeni Oluşturulacak:
- `src/hooks/use-mobile.ts`
- `src/components/layouts/mobile-sidebar-drawer.tsx`

### Değişecek (öncelik sırasıyla):
1. `src/app/staff/layout.tsx`
2. `src/components/layouts/mobile-bottom-nav.tsx`
3. `src/app/staff/my-trainings/page.tsx`
4. `src/app/staff/calendar/page.tsx`
5. `src/app/staff/dashboard/page.tsx`
6. `src/app/staff/profile/page.tsx`
7. `src/app/staff/smg/page.tsx`
8. `src/app/staff/my-trainings/[id]/page.tsx`
9. `src/app/staff/certificates/page.tsx`
10. `src/app/staff/notifications/page.tsx`
11. `src/app/staff/evaluations/page.tsx`
12. `src/app/staff/evaluations/[id]/page.tsx`
13. `src/app/staff/kvkk/page.tsx`
