import type { Metadata } from 'next';
import { pageMetadata, HOME_LANGUAGES } from '@/lib/site-metadata';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { Header } from '@/components/landing-3d/header';
import { LoadingScreen } from '@/components/landing-3d/loading-screen';
import { SceneClient } from '@/components/landing-3d/scene-client';
import { ScrollSections } from '@/components/landing-3d/scroll-sections';
import { MobileReveal } from '@/components/landing-3d/mobile-reveal';
import '@/app/landing-3d/landing-3d.css';

export const metadata: Metadata = pageMetadata({
  title: 'Hastane Personel Eğitim ve Sınav Platformu | KlinoVax',
  description:
    'Hastane eğitimlerini tek akışta yönetin: atama, ileri sarılamayan video, ön ve son sınav, QR ile doğrulanan sertifika ve denetim raporları.',
  path: '/',
  absoluteTitle: true,
  languages: HOME_LANGUAGES,
});

export default function LandingPage() {
  return (
    <>
      {/* Refresh hep hero'da başlasın (hydration'dan önce server HTML'inde çalışır). */}
      <script
        dangerouslySetInnerHTML={{
          // Refresh hep hero'da başlasın + mobilde (reduced-motion değilse) scroll-reveal
          // gate'ini paint'TEN ÖNCE ekle (FOUC yok; desktop/reduced-motion'da eklenmez).
          __html:
            "history.scrollRestoration='manual';window.scrollTo(0,0);" +
            "try{if(window.matchMedia('(max-width:768px)').matches&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches){document.documentElement.classList.add('l3d-anim-ready')}}catch(e){}",
        }}
      />
      {/* Statik künye (kullanıcı girdisi yok) — şirket doğrulaması için makine-okunur */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJsonLd('tr') }}
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
        <MobileReveal />
        <ScrollSections />
      </div>
    </>
  );
}
