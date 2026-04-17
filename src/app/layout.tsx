import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono, Space_Grotesk, Outfit, Bricolage_Grotesque, Syne, DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${outfit.variable} ${bricolage.variable} ${syne.variable} ${dmSans.variable}`}
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
          <AuthProvider>
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
