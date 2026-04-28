import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types/database";
import { ToastProvider } from "@/components/shared/toast";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { DevSWCleaner } from "@/components/dev-sw-cleaner";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { CrispWidget } from "@/components/providers/crisp-widget";
import "./globals.css";

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display-loaded",
});

const fontBody = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body-loaded",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono-loaded",
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
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
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
            <ToastProvider>
              <ErrorBoundary>
                {children}
                {process.env.NODE_ENV === 'development' && <DevSWCleaner />}
                <PWAInstallPrompt />
                <CookieConsent />
                <CrispWidget />
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
