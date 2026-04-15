'use client';

import Script from 'next/script';

/**
 * Crisp chat widget — marketing + app sayfalarında canlı destek.
 *
 * Kurulum:
 *   1. https://crisp.chat adresinden ücretsiz hesap aç
 *   2. Settings → Website Settings → Setup → Website ID kopyala
 *   3. .env.local dosyasına ekle: NEXT_PUBLIC_CRISP_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * Widget ID yoksa hiçbir şey render edilmez.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

export function CrispWidget() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

  if (!websiteId) return null;

  return (
    <>
      <Script id="crisp-init" strategy="afterInteractive">
        {`
          window.$crisp = [];
          window.CRISP_WEBSITE_ID = "${websiteId}";
        `}
      </Script>
      <Script
        id="crisp-sdk"
        src="https://client.crisp.chat/l.js"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
