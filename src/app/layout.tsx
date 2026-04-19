import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono, Space_Grotesk, Outfit, Bricolage_Grotesque, Syne, DM_Sans, Fraunces } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types/database";
import { ToastProvider } from "@/components/shared/toast";
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { CrispWidget } from "@/components/providers/crisp-widget";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: false,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
  adjustFontFallback: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
});

// Login sayfasi font denemeleri icin
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-space-grotesk", display: "swap", adjustFontFallback: false });
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-outfit", display: "swap", adjustFontFallback: false });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-bricolage", display: "swap", adjustFontFallback: false });
const syne = Syne({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-syne", display: "swap", adjustFontFallback: false });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans", display: "swap", adjustFontFallback: false });

// Editorial display — premium modal başlıkları için (Fraunces variable: opsz 9-144, wght 100-900)
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Devakent Hastanesi - Personel Eğitim Sistemi",
  description: "Hastane personeli için eğitim ve sınav yönetim platformu",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // iOS safe-area support
  themeColor: "#0d9668",
};

// Supabase session → User shape. Client'taki AuthProvider'ın `setUser` ile ürettiği objeyle
// birebir aynı şema — SSR hydration'da uyumsuzluk olmaması için paralel tutuldu.
async function getInitialUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email ?? '',
      firstName: u.user_metadata?.first_name ?? '',
      lastName: u.user_metadata?.last_name ?? '',
      role: u.app_metadata?.role ?? u.user_metadata?.role ?? 'staff',
      organizationId: u.app_metadata?.organization_id ?? u.user_metadata?.organization_id ?? null,
      phone: u.user_metadata?.phone ?? null,
      departmentId: u.user_metadata?.department_id ?? null,
      department: u.user_metadata?.department ?? null,
      title: u.user_metadata?.title ?? null,
      avatarUrl: u.user_metadata?.avatar_url ?? null,
      isActive: u.user_metadata?.is_active !== false,
      kvkkNoticeAcknowledgedAt: u.user_metadata?.kvkk_notice_acknowledged_at ?? null,
      createdAt: u.created_at,
      updatedAt: u.updated_at ?? u.created_at,
    };
  } catch {
    // Session parse edilemedi — client fallback devreye girsin
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialUser();
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${outfit.variable} ${bricolage.variable} ${syne.variable} ${dmSans.variable} ${fraunces.variable}`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d9668" />
        {/* Pre-paint data-color set — FOUC önler. Next 16 App Router'da native script + dangerouslySetInnerHTML zorunlu (next/script beforeInteractive artık desteklenmiyor). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('color-theme');if(t&&t!=='emerald')document.documentElement.setAttribute('data-color',t)}catch(_){}`,
          }}
        />

      </head>
      <body className="app-bg antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider initialUser={initialUser}>
            <SessionTimeoutProvider>
              <ToastProvider>
                <ErrorBoundary>
                  {children}
                  <PWAInstallPrompt />
                  <CookieConsent />
                  <CrispWidget />
                </ErrorBoundary>
              </ToastProvider>
            </SessionTimeoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
