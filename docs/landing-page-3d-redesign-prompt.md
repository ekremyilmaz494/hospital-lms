# KlinoVax — Scroll-Driven 3D Landing Page · Production Spec Prompt

> Bu dosya, Claude'a (Claude Code) verilecek **üretim şartnamesi** seviyesinde bir prompt'tur.
> Referans alınan metodoloji: LUMEN kamera landing page spec'i (exact files, exact constants, non-negotiables).
> Aşağıdaki `PROMPT BAŞLANGICI` bloğunun tamamını kopyalayıp Claude'a ver — veya Claude Code'a "bu spec'i uygula" de.

---

# ═══════════ PROMPT BAŞLANGICI ═══════════

Build a premium scroll-driven 3D medical landing page for **KlinoVax** — Next.js 16 + React Three Fiber v9.

Reproduce the implementation described below **EXACTLY**. Do not invent features, do not redesign anything, do not "improve" values. Every constant, animation duration, easing, colour token and behaviour in this brief is approved and must be reproduced verbatim. If a value appears in this brief, use that value. If a behaviour appears in this brief, implement that behaviour. Treat this document as a production spec, not as guidance. Tüm kullanıcıya görünen metinler **Türkçe**dir ve bu spec'te verildiği gibi birebir kullanılır.

═══════════════════════════════════════════════════════════════════════
## 1. PROJECT GOAL
═══════════════════════════════════════════════════════════════════════

A cinematic, scroll-driven 3D product landing page for **KlinoVax** — hastane, klinik ve eczaneler için personel eğitim & sınav yönetim platformu (LMS SaaS).

A single anatomical heart GLB model (`public/models/heart.glb`) stays on screen the entire scroll and rotates / repositions through **six approved keyframes** as the user scrolls. The page begins with a loading screen, then a slow turntable intro animation, then unlocks scroll for the keyframe sequence.

Mood: **klinik güven + sıcak editorial**. Warm off-white/beige background, olive-green ink, emerald brand accent, amber CTA. Large editorial headlines, generous whitespace. No animations on the model are allowed except those defined here.

Hedef kitle: hastane kalite direktörleri, başhekimler, İK müdürleri. Dönüşüm hedefi: **"Demo Talep Et"** butonuna tıklatmak.

═══════════════════════════════════════════════════════════════════════
## 2. TECH STACK (strict — bu repo'nun mevcut altyapısı)
═══════════════════════════════════════════════════════════════════════

Bu proje **mevcut monorepo'nun içinde** (`apps/web`) çalışır — sıfırdan proje KURMA:

* Next.js **16.2.x** (App Router — repo'da kurulu, dokunma)
* React **19.2.x** (repo'da kurulu, dokunma)
* TypeScript strict (repo config'i kullan)
* Tailwind CSS **4** (repo'da kurulu — `tailwind.config` YOK, CSS-first `@theme` kullanılıyor)
* **three** `^0.182.0`
* **@react-three/fiber** `^9.x` ← React 19 desteği için v9 ŞART (v8 React 19 ile ÇALIŞMAZ)
* **@react-three/drei** `^10.x` (sadece: `Environment`, `PerspectiveCamera`, `useGLTF` — başka import YOK)
* **gsap** `^3.13.x` (ScrollTrigger ile)
* Package manager: **pnpm** (npm/yarn YASAK — workspace komutu: `pnpm --filter web add ...`)

No additional libraries. **No Lenis, no Zustand for this feature, no extra animation libraries besides GSAP.** Mevcut framer-motion'a dokunma ama yeni 3D landing'de KULLANMA — tüm animasyon GSAP. LoadingScreen ↔ HeartModel koordinasyonu plain CustomEvent ile (`src/lib/scene-ready.ts`).

Kurulum komutu (aynen bu):
```bash
pnpm --filter web add three@^0.182.0 @react-three/fiber@^9 @react-three/drei@^10 gsap@^3.13
pnpm --filter web add -D @types/three@^0.182.0
```

═══════════════════════════════════════════════════════════════════════
## 3. EXACT FILE STRUCTURE
═══════════════════════════════════════════════════════════════════════

Tüm yeni dosyalar `apps/web/` altına. Mevcut `src/components/landing/` klasörüne DOKUNMA (eski tasarım, geri dönüş için duruyor). Yeni klasör: `landing-3d`.

```
apps/web/
├── src/app/page.tsx                       (DEĞİŞTİRİLİR — yeni 3D landing'i compose eder)
├── src/app/landing-3d.css                 (YENİ — 3D landing'e özel CSS, globals.css'e dokunma)
├── src/components/landing-3d/
│   ├── header.tsx                         (fixed nav — KlinoVax logo + linkler + Giriş)
│   ├── loading-screen.tsx                 (preloader + scroll kilidi)
│   ├── scene-client.tsx                   ("use client" + next/dynamic ssr:false wrapper)
│   ├── scene.tsx                          (R3F Canvas, ışıklar, environment)
│   ├── heart-model.tsx                    (GLB load, material fix, GSAP intro + scroll timeline)
│   ├── procedural-environment.tsx         (RoomEnvironment IBL — mobil için)
│   ├── scroll-sections.tsx                (altı <section> — Türkçe copy)
│   ├── feature-stat.tsx                   (sayı + etiket bileşeni)
│   └── scroll-states.ts                   (SCROLL_STATES array + mobil faktörler)
├── src/lib/scene-ready.ts                 (lockScroll/unlockScroll + texturesReady/introStart)
└── public/models/heart.glb                (REQUIRED ASSET — kullanıcı sağlar)
```

Eski `src/app/page.tsx` içeriğini `src/app/page-legacy.tsx.bak` olarak yedekle (import edilmez, sadece dosya olarak durur).

═══════════════════════════════════════════════════════════════════════
## 4. REQUIRED ASSET + GÖRSEL ÜRETİM (fal.ai / MCP)
═══════════════════════════════════════════════════════════════════════

**3D Model:** `public/models/heart.glb` — anatomik insan kalbi, **2 MB altı**, GLB (binary glTF). Kaynak: Sketchfab → "anatomical heart" → ücretsiz + CC + downloadable filtrele → GLB indir. Kalp seçiminin sebebi: organik, her açıdan detaylı, sağlık sektörünün evrensel sembolü, CPR/acil eğitim temasıyla birebir örtüşür.

Model eksikse: `<TorusKnot>` placeholder KULLANMA — bunun yerine üç adet üst üste bindirilmiş `<Sphere>` + `<Capsule>` kompozisyonuyla stilize organik bir form kur, `// TODO: heart.glb gelince kaldır` yorumu bırak ve sayfanın geri kalanını eksiksiz bitir.

**Material fix zorunlu:** GLB'nin materyalleri `alphaMode: BLEND` + `doubleSided: true` ile gelirse model röntgen (x-ray) gibi görünür. Her materyal klonlanıp `transparent=false, opacity=1, depthWrite=true, depthTest=true, side=FrontSide` zorlanır. Adında `vein/artery/valve/glass` geçen materyaller hariç (onlar yarı saydam kalır, opacity 0.5).

**Destekleyici görseller (fal.ai veya mevcut görsel üretim MCP'si ile üretilebilir):**
| Görsel | Boyut | Prompt önerisi | Kullanım |
|---|---|---|---|
| OG / sosyal paylaşım görseli | 1200×630 | "warm beige editorial medical illustration, anatomical heart line art, emerald green accents, minimal, premium" | `metadata.openGraph.images` |
| Section 5 arkaplan dokusu | 1920×1080 | "subtle topographic line pattern, dark olive green background, very low contrast" | Kanıt section'ı arka planı |
| Demo video posteri | 1280×720 | "modern hospital training dashboard on laptop screen, warm lighting, shallow depth of field" | İleride promo video eklenirse poster |

Bu görseller spec'in zorunlu parçası DEĞİL — model + tipografi + renk yeterli. Üretilirse `public/landing/` altına koyulur.

═══════════════════════════════════════════════════════════════════════
## 5. DESIGN TOKENS (kesin — mevcut marka token'ları)
═══════════════════════════════════════════════════════════════════════

Renkler — `apps/web/src/styles/tokens.css` içindeki MEVCUT token'lar kullanılır, yeni hex İCAT ETME:

```
--landing-bg:           #fafaf9    (sayfa + canvas arka planı, sıcak off-white)
--landing-surface:      #f5f0e6    (bej section zemini)
--landing-ink:          #1a3a28    (ana metin — koyu zeytin)
--landing-ink-soft:     #4a7060    (ikincil metin)
--landing-brand:        #0d9668    (emerald — logo, vurgu, ilerleme)
--landing-accent:       #f59e0b    (amber — CTA pill)
--landing-accent-deep:  #d97706    (amber hover)
--landing-rule:         rgba(26, 58, 40, 0.08)   (ince çizgiler)
```

Font'lar — repo'da `next/font` ile YÜKLÜ, yeni font ekleme:
- Display/başlık: **Plus Jakarta Sans** (`var(--font-display)` veya mevcut değişken adı neyse)
- Body: **Inter**
- Mono (eyebrow + istatistik): **JetBrains Mono**

Tipografi skalası (`landing-3d.css` içine class olarak):

```
.l3d-headline    → clamp(64px, 12vw, 180px); weight 800; line-height 0.92; letter-spacing -0.04em
.l3d-headline-md → clamp(48px, 9vw, 140px);  weight 700; line-height 0.95; letter-spacing -0.035em
.l3d-final-title → clamp(44px, 7.5vw, 112px); weight 600; line-height 0.92; letter-spacing -0.035em
.l3d-eyebrow     → 12px; uppercase; letter-spacing 0.18em; weight 500; mono font; color rgba(26,58,40,0.55)
.l3d-cta         → amber pill: background var(--landing-accent); color #fff; padding 14px 28px;
                   border-radius 999px; weight 600; font-size 15px;
                   hover: translateY(-2px) + background var(--landing-accent-deep)
                   transition: transform 0.3s ease, background 0.3s ease   (transition-all YASAK — repo kuralı)
```

YASAKLAR: mor gradient, raw Tailwind renk class'ı (`bg-green-500` vb.), `transition-all`, yeni font, stock fotoğraf, lorem ipsum.

═══════════════════════════════════════════════════════════════════════
## 6. src/components/landing-3d/scroll-states.ts — EXACT FILE (DO NOT TWEAK VALUES)
═══════════════════════════════════════════════════════════════════════

```typescript
export type ScrollState = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

export const SCROLL_STATES: ScrollState[] = [
  // 0 — Hero: sağ tarafta, 3/4 açı, hafif yukarı bakış.
  { id: "hero",     position: [ 0.75,  0.05,  0.0],  rotation: [ 0.10,  Math.PI - 0.70,  0.05], scale: 1.9 },
  // 1 — Closeup: sola ve öne, büyük — ventrikül detayı görünür.
  { id: "closeup",  position: [-0.70,  0.00,  0.7],  rotation: [ 0.05,  Math.PI - 0.20,  0.02], scale: 2.1 },
  // 2 — Front: ortada, tam karşıdan.
  { id: "front",    position: [-0.25, -0.05,  0.2],  rotation: [ 0.02,  Math.PI,         0.0 ], scale: 1.8 },
  // 3 — Top: üstten, yatay duruş — atriyum detayı.
  { id: "top",      position: [ 0.00,  0.05,  0.4],  rotation: [ Math.PI / 2 - 0.15, 0.0, Math.PI / 2], scale: 1.75 },
  // 4 — Back: çapraz arkadan, sağda.
  { id: "back",     position: [ 0.60, -0.05,  0.0],  rotation: [-0.10, -1.40,            0.15], scale: 1.6 },
  // 5 — Final: solda, karşıya dönük, hafif büyütülmüş.
  { id: "final",    position: [-0.90, -0.05,  0.2],  rotation: [ 0.05,  Math.PI - 0.40, -0.02], scale: 1.9 },
];

// Mobil/tablet çarpanları (≤1023px). Hareketi merkeze sıkıştırır,
// modeli küçük canvas bandını dolduracak şekilde büyütür.
export const MOBILE_SCALE_FACTOR = 1.1;
export const MOBILE_POSITION_FACTOR = 0.1;
```

═══════════════════════════════════════════════════════════════════════
## 7. src/lib/scene-ready.ts — EXACT BEHAVIOUR
═══════════════════════════════════════════════════════════════════════

LUMEN spec'indeki `lib/sceneReady.ts` ile birebir aynı mantık, sadece event prefix'i değişir:
`lumen:texturesReady` → `klinovax:texturesReady`, `lumen:introStart` → `klinovax:introStart`.

Beş fazlı koordinasyon sözleşmesi:
```
Phase 1   page mount       LoadingScreen → lockScroll()  (html+body overflow:hidden + scrollTo(0,0))
Phase 2   GLB loaded       <HeartModel> mounts (Suspense resolves)
Phase 3   materials ready  HeartModel → markTexturesReady()  → LoadingScreen görür, fade out başlatır
Phase 4   fade complete    LoadingScreen → markIntroStart()  → HeartModel görür, intro oynatır
Phase 5   intro complete   HeartModel → unlockScroll() + buildScrollTimeline()
```

Fonksiyonlar: `lockScroll`, `unlockScroll`, `markTexturesReady`, `onTexturesReady`, `markIntroStart`, `onIntroStart`. Hepsi SSR-safe (`typeof window === "undefined"` guard), event'ler `{ once: true }`, geç abone olunursa `queueMicrotask(cb)` ile anında tetiklenir.

═══════════════════════════════════════════════════════════════════════
## 8. src/components/landing-3d/scene.tsx — EXACT RIG
═══════════════════════════════════════════════════════════════════════

```
PerspectiveCamera (drei): position [0, 0, 4.5], fov 32, makeDefault
Tone mapping: ACESFilmicToneMapping · outputColorSpace: SRGBColorSpace

Desktop (≥1024px):
  ambientLight            intensity 0.25
  KEY  directionalLight   position [-6, 3, 5]   intensity 1.6   #ffffff
  FILL directionalLight   position [ 5, 2, 4]   intensity 0.6   #fff7ed   (sıcak dolgu — bej zemine uyum)
  RIM  directionalLight   position [ 3, 3,-6]   intensity 1.2   #d1fae5   (emerald-tinted kenar ayrımı)
  Environment preset="studio", environmentIntensity 1.2
  Canvas dpr [1, 2], antialias true, powerPreference "high-performance"
  toneMappingExposure 1.25

Mobil + tablet (≤1023px):
  ambient + key + fill aynı. RIM YOK.
  Environment HDR YOK → ProceduralEnvironment (RoomEnvironment + PMREMGenerator), intensity 1.0
  Canvas dpr [0.85, 1.1], antialias false, powerPreference "low-power"
  toneMappingExposure 1.15

Gölge YOK (gölge düzlemi yok, maliyet boşa). Postprocessing YOK.
isMobile tespiti: window.matchMedia("(max-width: 1023px)").matches — useMemo içinde, SSR'da false.
```

═══════════════════════════════════════════════════════════════════════
## 9. src/components/landing-3d/heart-model.tsx — BEHAVIOUR CONTRACT
═══════════════════════════════════════════════════════════════════════

Bu dosya projenin kalbi. DÖRT iş yapar:

**(a) Normalize:** GLB'yi `Box3` ile ölç, merkeze al, max-dim → 1 birim olacak şekilde uniform scale et. Böylece SCROLL_STATES değerleri model-bağımsız olur.

**(b) MATERIAL FIX:** Her materyali klonla, glass-benzeri olmayanları (isim heuristic: `vein`, `artery`, `valve`, `glass` İÇERMEYEN) zorla:
`transparent=false, opacity=1, depthWrite=true, depthTest=true, side=THREE.FrontSide, alphaTest=0`.
Glass-benzeri olanlar: `transparent=true, opacity=0.5, depthWrite=false, side=FrontSide`.
Roughness clamp [0.3, 0.6], metalness clamp [0.0, 0.2] (organik doku — kamera spec'inden farklı, kalp metalik DEĞİL).
Materyal işleme bitince `markTexturesReady()` çağrılır (texture rescue gerekmiyorsa da çağrılır — preloader'ın kapanma sinyali budur).

**(c) TEXTURE RESCUE:** GLB `KHR_materials_pbrSpecularGlossiness` (deprecated) ile yazılmışsa Three.js r152+ texture'ları düşürür → model gri "clay" görünür. `gltf.parser.getDependency("texture", index)` ile diffuse + normal texture'ları bufferView'lardan çek, klonlanmış materyallere bağla. Diffuse → `THREE.SRGBColorSpace`, normal → `THREE.NoColorSpace`. Spec-gloss yoksa `logger.warn` ile geç (repo kuralı: `console.log` YASAK — `@/lib/logger` kullan, sadece dev'de logla).

**(d) INTRO + SCROLL TIMELINE (GSAP):**
- Mount'ta model, hero pozunun rotation.y'sine **+2.5 radyan** offset'le yerleştirilir (pozisyon TAM hero'da — kayma yok). `useLayoutEffect` ile pre-paint set edilir.
- `gsap.set("[data-hero-text]", { opacity: 0, y: 22 })`
- Intro timeline `paused: true` kurulur, `klinovax:introStart` event'ini bekler.
- **Intro = sadece rotation.y turntable**: +2.5 rad → hero.ry, süre **3.6s**, ease **sine.inOut**. Pozisyon tween'i YOK.
- Hero metni intro'nun **1.8s**'inde reveal: `opacity 1, y 0, stagger 0.12, duration 0.85, ease power2.out`.
- `onComplete`: ① `unlockScroll()` ② `buildScrollTimeline()` (aynı `gsap.context` içinde — unmount'ta `ctx.revert()` temiz kapatır).
- **Scroll timeline**: TEK timeline, TEK ScrollTrigger. `trigger: "main"`, `start: "top top"`, `end: "bottom bottom"`, `scrub: 1.5`, `invalidateOnRefresh: true`, segment ease `"none"` (scrub zaten yumuşatıyor — üstüne ease eklemek robotik yapar). 5 geçiş, timeline pozisyonları 0..4, her geçişte position+rotation+scale birlikte tween'lenir. Sonda `ScrollTrigger.refresh()`.
- Mobilde: `position × MOBILE_POSITION_FACTOR`, `scale × MOBILE_SCALE_FACTOR`, `+0.3` world-Y lift.

`useGLTF.preload("/models/heart.glb")` dosya sonunda çağrılır.

═══════════════════════════════════════════════════════════════════════
## 10. src/components/landing-3d/scroll-sections.tsx — EXACT TURKISH COPY
═══════════════════════════════════════════════════════════════════════

Altı section, bu sırayla, bu ID'lerle, bu metinlerle (değiştirme):

**§1 — HERO** `id="hero" data-section="hero"`
```
eyebrow  (data-hero-text):  "PERSONELİNİZ HER ZAMAN"
h1       (data-hero-text):  "Hazır."
paragraf (data-hero-text):  "Hastane, klinik ve eczaneler için uçtan uca eğitim platformu.
                             Atama, video eğitim, sınav, sertifika ve KVKK uyum raporlaması —
                             hepsi tek akışta, denetime her an hazır."
CTA      (data-hero-text):  "Demo Talep Et"  → href "/demo"  (amber pill, .l3d-cta)
İkincil link:               "Nasıl çalışır →"  → href "#akis"  (text link, emerald, underline-on-hover)
Scroll cue (sadece desktop): "Keşfetmek için kaydırın" + 1px dikey çizgi
```
Layout: metin solda `max-w-[52%]` (desktop), model sağda (state 0: x=0.75). Mobilde metin ortada.

**§2 — CLOSEUP** `id="egitim" data-section="closeup"`
```
eyebrow:  "KLİNİK DİSİPLİN"
h2:       "Eğitim.\nDisiplinle."
paragraf: "İleri sarılamayan video eğitimler, ön ve son sınavlar, otomatik geçme/kalma değerlendirmesi.
           Personeliniz izlemiş gibi yapamaz — gerçekten öğrenir."
```
Layout: metin sağda `max-w-[40%]` (model state 1'de solda).

**§3 — FRONT + STATS** `id="kanit" data-section="front"`
```
eyebrow:  "KANITLANMIŞ SONUÇ"
h2:       "Denetim anına\nher zaman hazır."
Stats (FeatureStat bileşeni, sağ üstte dikey dizilim):
  label "TAMAMLANAN EĞİTİM"   value "12.480"  unit "+"
  label "BAŞARI ORANI"        value "94"      unit "%"
  label "AKTİF KURUM"         value "40"      unit "+"
```
Layout: metin sol-alt `[18vh, 10vw]` absolute (desktop), stats sağ-üst `[22vh, 10vw]`.

**§4 — TOP** `id="olcek" data-section="top"`
```
eyebrow:  "ÇOK KURUMLU YAPI"
h2:       "Kurumunuzla\nbirlikte ölçeklenir."
paragraf: "Tek hastaneden hastane zincirine. Her kurum tamamen izole verisiyle,
           kendi personeli, kendi eğitimleri ve kendi raporlarıyla çalışır."
```
Layout: metin solda `max-w-[40%]`.

**§5 — BACK** `id="erisim" data-section="back"`
```
eyebrow:  "HER YERDEN ERİŞİM"
h2:       "Vardiyada, evde,\nserviste."
paragraf: "Personel eğitimini telefonundan tamamlar, sertifikasını anında indirir.
           Yöneticiler canlı ilerlemeyi panelden izler — Excel tablosu beklemeden."
```
Layout: metin solda `max-w-[40%]` (model state 4'te sağda).

**§6 — FINAL** `id="demo-cta" data-section="final"`
```
eyebrow:  "KLİNOVAX'I DENEYİN"
h2 (final-title):  "Canlı\n3D\n[demo]"     ← "demo" kelimesi amber pill içinde, beyaz italic metin
CTA: "Demo Talep Et"  → href "/demo"  (amber pill, ortalanmış)
```
Layout: metin sağda (desktop) / ortalanmış canvas bandının altında (mobil).

`<footer>` `<main>` DIŞINDA (ScrollTrigger end "bottom bottom" hesabı bozulmasın):
```
© KlinoVax · Eğitim Platformu        Gizlilik · KVKK · Kullanım Şartları · İletişim
```
Mevcut linkler korunur: `/privacy`, `/kvkk`, `/terms`, `/contact`.

═══════════════════════════════════════════════════════════════════════
## 11. HEADER — EXACT
═══════════════════════════════════════════════════════════════════════

Fixed, `z-50`, `pointer-events-none` (linkler `pointer-events-auto`):
```
Sol:  "KlinoVax" logotype — emerald (--landing-brand), weight 800, 24px
Orta (desktop only): "Eğitim" #egitim · "Kanıt" #kanit · "Fiyatlandırma" /pricing · "İletişim" /contact
Sağ:  "Giriş Yap" → /login  (outline pill, ink rengi, hover'da emerald border)
Mobil: hamburger (2 çizgi) — menü açılır panel ŞART DEĞİL, sadece /login'e gider
```

═══════════════════════════════════════════════════════════════════════
## 12. LOADING SCREEN — EXACT
═══════════════════════════════════════════════════════════════════════

```
Tam ekran fixed, z-index 1000, background var(--landing-bg)
Ortada:
  "KlinoVax"        → emerald, weight 800, 32px, letter-spacing -0.02em
  "3D DENEYİM HAZIRLANIYOR"  → 11px, uppercase, letter-spacing 0.22em, rgba(26,58,40,0.5)
  1px × 180px bar   → içinde %35 genişlikte ink-renkli dolgu, soldan sağa sonsuz sweep
                      animation: 1.6s cubic-bezier(0.65, 0.05, 0.36, 1) infinite
Davranış:
  - Mount'ta lockScroll()
  - klinovax:texturesReady gelince → 280ms bekle → opacity fade (0.5s) → 520ms sonra markIntroStart()
  - Bar GERÇEK progress GÖSTERMEZ — CSS sweep'tir. Hazır sinyali texturesReady event'idir.
  - drei'den HİÇBİR ŞEY import etme (three.js'i ana bundle'a sokar, code-split'i bozar)
  - role="status" aria-live="polite" + sr-only "Yükleniyor" metni
prefers-reduced-motion: reduce → bar animasyonu yok, 0.5s statik logo, intro atlanır,
  model direkt hero pozunda, scroll hemen açık.
```

═══════════════════════════════════════════════════════════════════════
## 13. RESPONSIVE CONTRACT (≤1024px)
═══════════════════════════════════════════════════════════════════════

```
CSS breakpoint: @media (max-width: 1024px) (landing-3d.css)
JS breakpoint:  matchMedia("(max-width: 1023px)")

Desktop (>1024px):
  .l3d-section: flex-row, items-center, min-height 100vh, padding 0 8vw
  .l3d-scene-fixed: position fixed, inset 0, z-index 0, pointer-events none

Mobil/tablet (≤1024px):
  .l3d-scene-fixed: top 30vh, height 42vh  (canvas sadece orta bandı boyar)
  .l3d-section: flex-col, items-start, padding 14vh 6vw 4vh
  Section içi h1/h2: margin-bottom 42vh (canvas bandı için boşluk —
    eyebrow+başlık üstte, paragraf+CTA altta, canvas ortada)
  [data-section="final"] h2: margin-bottom 0.5rem (CTA başlığa yakın)
  [data-section="final"] > div:first-child: margin-top 60vh
  Model çarpanları: scale ×1.1, position ×0.1, +0.3 world-Y (heart-model.tsx içinde)
  Stats yatay dizilir (flex-row), absolute positioning sadece lg: prefix'inde
```

═══════════════════════════════════════════════════════════════════════
## 14. PERFORMANCE BUDGET (Lighthouse mobile ≥ 75, desktop ≥ 90)
═══════════════════════════════════════════════════════════════════════

* `next/dynamic(() => import("./scene"), { ssr: false })` çağrısı **"use client"** wrapper'da (`scene-client.tsx`) olmak ZORUNDA — Server Component'ten çağrılırsa Next sessizce ana chunk'ta tutar. Three.js + drei + R3F + GSAP (~250kB) lazy chunk'a ayrılmalı.
* `loading-screen.tsx` drei/three'den HİÇBİR ŞEY import etmez.
* `<link rel="preload" href="/models/heart.glb" as="fetch" type="model/gltf-binary" crossOrigin="anonymous">` — `src/app/page.tsx` veya layout head'inde. GLB indirmesi JS bundle'larıyla paralel başlar.
* Inline script (hydration'dan önce): `history.scrollRestoration = 'manual'; window.scrollTo(0,0)` — refresh hep hero'da başlar.
* Mobil Canvas: dpr [0.85, 1.1], antialias off, low-power, RIM ışık yok, HDR yerine RoomEnvironment.
* Repo'nun pre-commit hook'u (`scripts/perf-check.js`) çalışacak — `console.log` kullanma (`@/lib/logger`), `transition-all` kullanma, `supabase.auth.getUser()` zaten yok.
* Sekme görünmez olduğunda (`document.visibilityState === 'hidden'`) render durdurulur.

═══════════════════════════════════════════════════════════════════════
## 15. NON-NEGOTIABLES (pazarlık edilemez)
═══════════════════════════════════════════════════════════════════════

* SCROLL_STATES dizisi finaldir. Position/rotation/scale değerlerini AYARLAMA.
* MOBILE_SCALE_FACTOR = 1.1, MOBILE_POSITION_FACTOR = 0.1, mobil yOffset = 0.3. Değiştirme.
* Intro sadece rotation'dır. Pozisyon kayması YOK. Y offset +2.5 rad. Süre 3.6s. Ease sine.inOut.
* Hero metin reveal tam 1.8s'de, stagger 0.12, duration 0.85, power2.out.
* Scroll timeline: scrub 1.5, segment ease "none". TEK timeline, TEK ScrollTrigger. Section başına ayrı ScrollTrigger YASAK (zıplama/çakışma yaratır).
* Türkçe copy birebir bu spec'ten alınır. İngilizce metin, lorem ipsum, placeholder metin YASAK.
* Renkler sadece --landing-* token'larından. Yeni renk, mor gradient, raw Tailwind renk class'ı YASAK.
* Yeni font YASAK. transition-all YASAK. console.log YASAK (logger kullan).
* Kullanıcı yükleme ve intro sırasında ASLA scroll edemez. Scroll sadece intro.onComplete'te açılır.
* Loading bar gerçek progress göstergesine ÇEVRİLMEZ — CSS sweep'tir, hazır sinyali texturesReady'dir.
* Gölge yok, postprocessing yok, ekstra kütüphane yok.
* Mevcut `src/components/landing/` klasörü SİLİNMEZ — dokunulmaz, geri dönüş için durur.
* Mevcut `(marketing)` route group, admin/staff/exam panelleri, API route'ları — HİÇBİRİNE dokunulmaz.

═══════════════════════════════════════════════════════════════════════
## 16. DELIVERABLES + LOCALHOST PREVIEW (FINAL STEP — DO NOT SKIP)
═══════════════════════════════════════════════════════════════════════

1. Yukarıdaki tüm dosyaları aynen oluştur. Paketleri pnpm ile kur.
2. `pnpm --filter web exec tsc --noEmit` → temiz olacak.
3. `pnpm --filter web lint` → error yok.
4. Mevcut testler bozulmayacak: `pnpm --filter web test` (3D landing testi yazmak şart değil ama mevcutlar geçmeli).
5. Dev server'ı ARKA PLANDA başlat: `pnpm --filter web dev` → "Ready" satırını bekle → curl ile doğrula:
   - `curl -sI http://localhost:3000` → 200
   - `curl -sI http://localhost:3000/models/heart.glb` → 200 (GLB konmadıysa 404 kabul, uyar ama server'ı KAPAT-MA)
6. Dev server'ı başlattıktan sonra `next build` ÇALIŞTIRMA (.next'i ezer, chunk'lar 404 olur). Type-check için sadece `tsc --noEmit`.
7. Beş fazlı intro akışını reload ile test et: loading screen → fade → 3.6s turntable → 1.8s'de hero metin → scroll açılır → 6 keyframe yumuşak geçer.
8. Mobil emülasyon test (430×932): canvas orta bantta, metin üstte/altta, çakışma yok.
9. Cevabın sonunda şu açıklamaları ver: (a) material fix röntgen görünümünü nasıl çözer, (b) beş fazlı akış LoadingScreen ↔ HeartModel'i nasıl koordine eder, (c) scroll timeline SCROLL_STATES arasında nasıl interpolasyon yapar, (d) hangi sabitler görsel ayar içindir, hangileri dokunulmazdır.
10. Cevabın EN SON satırı, başka hiçbir şey olmadan:
    ▶ Canlı önizleme: [http://localhost:3000](http://localhost:3000)

Build everything now. Do not skip the material fix. Do not modify SCROLL_STATES. Do not pull in extra libraries. The output must match this brief value-for-value.

# ═══════════ PROMPT SONU ═══════════

---

## Kullanım Notları (prompt'un parçası değil)

1. **GLB modeli:** Sketchfab → "anatomical heart" → ücretsiz/CC/downloadable → GLB (≤2MB) indir → `apps/web/public/models/heart.glb`. Model olmadan da prompt çalışır (placeholder kurar), ama gerçek etki model ile gelir.
2. **Bu repo'da çalıştırma:** Bu spec'i Claude Code'a "docs/landing-page-3d-redesign-prompt.md'deki spec'i uygula" diyerek verebilirsin — dosya yapısı ve komutlar bu monorepo'ya göre yazıldı.
3. **fal.ai / görsel üretim:** OG görseli ve dokular için bölüm 4'teki promptlar kullanılabilir. Bu oturumda bağlı görsel üretim MCP araçları da aynı işi görür.
4. **Neden kalp, neden kamera değil:** Kameranın spec'indeki "texture rescue" Canon GLB'sine özeldi; kalp modelinde genellikle gerekmez ama kod yolunda korunur (zarar vermez). Organik model + sağlık teması = KlinoVax'ın hikayesi.
5. **Eski landing'e dönüş:** `git revert` veya `page-legacy.tsx.bak` → `page.tsx` yeniden adlandırma yeterli. Eski bileşenler silinmiyor.
