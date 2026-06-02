import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Header } from "@/components/landing-3d/header";
import { LoadingScreen } from "@/components/landing-3d/loading-screen";
import { SceneClient } from "@/components/landing-3d/scene-client";
import { ScrollSections } from "@/components/landing-3d/scroll-sections";
import "./landing-3d.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — Hastaneler için Eğitim & Sınav Platformu`,
  description:
    "Hastane, klinik ve eczaneler için uçtan uca personel eğitim platformu. Atama, video eğitim, sınav, sertifika ve KVKK uyum raporlaması — tek akışta.",
  openGraph: {
    title: `${BRAND.name} — Personeliniz Her Zaman Hazır`,
    description:
      "Hastane, klinik ve eczaneler için uçtan uca eğitim platformu. Denetime her an hazır.",
    type: "website",
    locale: "tr_TR",
  },
};

export default function Landing3DPage() {
  return (
    <>
      {/* Refresh hep hero'da başlasın (hydration'dan önce server HTML'inde çalışır). */}
      <script
        dangerouslySetInnerHTML={{
          __html: "history.scrollRestoration='manual';window.scrollTo(0,0);",
        }}
      />
      <div className="l3d-page">
        <Header />
        {/* Hero arka planı — canvas'tan önce (z0, DOM sırası) → 3D telefon üstüne biner.
            absolute + 100vh: hero'dan sonra kayıp gider, fixed canvas devam eder. */}
        <div className="l3d-hero-bg" aria-hidden="true" />
        {/* §2 arka planı — 2. viewport (top:100vh) hizasında, canvas'ın altında. */}
        <div className="l3d-sec2-bg" aria-hidden="true" />
        {/* §5/§6 arka plan bantları — ilgili viewport'un altında, kısa boy, telefonun
            arkasında (z0 + canvas'tan önce DOM sırası). */}
        <div className="l3d-sec5-bg" aria-hidden="true" />
        <div className="l3d-sec6-bg" aria-hidden="true" />
        <SceneClient />
        <LoadingScreen />
        <ScrollSections />
      </div>
    </>
  );
}
