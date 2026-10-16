/**
 * Oturum gerektirmeyen rotaların TEK kaynağı.
 *
 * Proxy (public/protected kararı), sitemap (indekslenebilir sayfalar) ve testler aynı
 * listeyi okur — liste dağılınca "sayfa var ama ziyaretçi login'e atılıyor" hatası doğar
 * (Ekim 2026: /cerez-politikasi ve /data-retention footer'dan link'liydi ama public değildi).
 *
 * Proxy bu dosyayı import eder: bağımlılık EKLEME (edge/node proxy bundle'ı şişmesin).
 */

export interface SiteRoute {
  /** Baştaki `/` dahil yol. Sondaki `/` YOK. */
  path: string;
  /**
   * `true` → yolun kendisi + alt yolları (`/davet/abc`) public.
   * `false` → yalnız tam eşleşme (`/` gibi kök yollar alt ağacı açmasın).
   * Eşleşme her zaman segment sınırındadır: `/demo` asla `/demox`'i açmaz.
   */
  prefix: boolean;
  /** Sitemap'e girer mi? Auth/API/yardımcı rotalar public ama indekslenmez. */
  indexable: boolean;
}

export const SITE_ROUTES: readonly SiteRoute[] = [
  // ── Pazarlama (indekslenebilir) ──
  { path: '/', prefix: false, indexable: true },
  { path: '/en', prefix: true, indexable: true },
  { path: '/hakkimizda', prefix: true, indexable: true },
  { path: '/demo', prefix: true, indexable: true },
  { path: '/contact', prefix: true, indexable: true },
  { path: '/kvkk', prefix: true, indexable: true },
  { path: '/privacy', prefix: true, indexable: true },
  { path: '/terms', prefix: true, indexable: true },
  { path: '/cerez-politikasi', prefix: true, indexable: true },
  { path: '/data-retention', prefix: true, indexable: true },

  // ── Public ama indekslenmez ──
  { path: '/sectors', prefix: true, indexable: false },
  { path: '/pricing', prefix: true, indexable: false }, // route silindi; login'e değil temiz 404'e düşsün
  { path: '/register', prefix: true, indexable: false },
  { path: '/help', prefix: true, indexable: false },
  { path: '/docs', prefix: true, indexable: false },
  { path: '/certificates/verify', prefix: true, indexable: false },
  { path: '/davet', prefix: true, indexable: false },
  { path: '/login', prefix: false, indexable: false }, // /auth/login'e yönlendiren eski yol
  { path: '/offline', prefix: false, indexable: false }, // PWA çevrimdışı sayfası
  { path: '/dev-reset', prefix: false, indexable: false },
  { path: '/clear-cache', prefix: false, indexable: false },
  { path: '/license', prefix: true, indexable: false }, // on-prem lisans ekranı (kilitliyken erişilebilir)

  // ── Auth akışı ──
  { path: '/auth/login', prefix: false, indexable: false },
  { path: '/auth/callback', prefix: true, indexable: false },
  { path: '/auth/forgot-password', prefix: false, indexable: false },
  { path: '/auth/reset-password', prefix: false, indexable: false },
  { path: '/auth/mfa-verify', prefix: false, indexable: false },
  { path: '/auth/mfa-setup', prefix: false, indexable: false },

  // ── Metadata dosya rotaları (OG/ikon görselleri crawler'a açık olmalı) ──
  { path: '/opengraph-image', prefix: true, indexable: false },
  { path: '/twitter-image', prefix: true, indexable: false },
  { path: '/icon', prefix: true, indexable: false },
  { path: '/apple-icon', prefix: true, indexable: false },

  // ── Public API (proxy /api/* için auth yapmaz; liste belgeleme + test içindir) ──
  { path: '/api/auth/invitations', prefix: true, indexable: false },
  { path: '/api/health', prefix: true, indexable: false },
  { path: '/api/docs', prefix: true, indexable: false },
  { path: '/api/cron', prefix: true, indexable: false },
  { path: '/api/payments/callback', prefix: true, indexable: false },
  { path: '/api/public', prefix: true, indexable: false },
  { path: '/api/license', prefix: true, indexable: false },
];

function matches(route: SiteRoute, pathname: string): boolean {
  if (pathname === route.path) return true;
  return route.prefix && pathname.startsWith(`${route.path}/`);
}

/**
 * Oturum gerektirmeyen (pazarlama, auth, public API) yol mu?
 * Fail-closed: listede olmayan her yol protected kabul edilir.
 */
export function isPublicRoute(pathname: string): boolean {
  return SITE_ROUTES.some((route) => matches(route, pathname));
}

/** Sitemap'e girecek yollar (sıra korunur). */
export function getIndexablePaths(): string[] {
  return SITE_ROUTES.filter((route) => route.indexable).map((route) => route.path);
}
