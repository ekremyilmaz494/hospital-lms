import type { Metadata } from "next";
import { MarketingHomeClient } from "./home-client";

// Next.js 16 webpack prerender'ı bu route için client reference manifest
// oluşturamıyor. force-dynamic runtime render ile sorunu atlatır.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hastane LMS - Hastane Personel Egitim ve Sinav Yonetim Sistemi",
  description:
    "Hastane personeli icin video tabanli egitim, sinav, sertifika ve akreditasyon yonetim platformu. 500+ hastane tarafindan tercih ediliyor.",
  openGraph: {
    title: "Hastane LMS - Personel Egitim ve Sinav Yonetim Sistemi",
    description:
      "Hastane personelinizi egitimler, sinavlar ve sertifikalarla yonetin. KVKK uyumlu, 7/24 erisim.",
    type: "website",
    locale: "tr_TR",
  },
};

export default function MarketingHomePage() {
  return <MarketingHomeClient />;
}
