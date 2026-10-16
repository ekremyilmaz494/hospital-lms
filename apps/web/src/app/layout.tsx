import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getBrowserRuntimeConfig, serializeBrowserConfigScript } from "@/lib/supabase/onprem-config";
import { isOnPrem } from "@/lib/deployment";
import { ToastProvider } from "@/components/shared/toast";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { DevSWCleaner } from "@/components/dev-sw-cleaner";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { BRAND } from "@/lib/brand";
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
  // Canonical/hreflang/OG göreli URL'leri kanonik alan adına çözülsün.
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: `${BRAND.fullName} - Personel Eğitim Sistemi`,
  description: BRAND.shortDesc,
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.name,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // iOS safe-area support
  themeColor: "#0d9668",
};

// Kök layout request-time API (cookies/headers) ÇAĞIRMAZ → bulutta pazarlama sayfaları
// statik prerender edilir. Session okuması `(app)/layout.tsx`'te.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // On-prem: tarayıcı-yüzlü config RUNTIME'da enjekte edilir (NEXT_PUBLIC_* build-time
  // gömülü olduğundan tek generic imaj için gerekli). Statik prerender bu değeri build
  // anında null'a dondururdu → imaj localhost Supabase'e kilitlenirdi. connection() on-prem'de
  // her sayfayı istek-başı render'a zorlar; bulutta isOnPrem()=false → sayfalar statik kalır.
  if (isOnPrem()) await connection();
  const onpremConfig = getBrowserRuntimeConfig();
  return (
    <html
      lang="tr"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <head>
        <meta name="theme-color" content="#0d9668" />
        {/* On-prem runtime config — HER client script'inden ÖNCE (Supabase browser client
            bunu okur). Bulutta onpremConfig null → hiç basılmaz, baked NEXT_PUBLIC kullanılır. */}
        {onpremConfig && (
          <script
            dangerouslySetInnerHTML={{ __html: serializeBrowserConfigScript(onpremConfig) }}
          />
        )}
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
          <ToastProvider>
            <ErrorBoundary>
              {children}
              {process.env.NODE_ENV === 'development' && <DevSWCleaner />}
              <CookieConsent />
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
