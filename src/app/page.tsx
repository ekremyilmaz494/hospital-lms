import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { HeroSection } from "./(landing)/hero-section";

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

const StatsSection = dynamic(() =>
  import("./(landing)/stats-section").then((m) => ({ default: m.StatsSection }))
);

const FeaturesSection = dynamic(() =>
  import("./(landing)/features-section").then((m) => ({ default: m.FeaturesSection }))
);

const CtaSection = dynamic(() =>
  import("./(landing)/cta-section").then((m) => ({ default: m.CtaSection }))
);

const TestimonialsSection = dynamic(() =>
  import("./(landing)/testimonials-section").then((m) => ({ default: m.TestimonialsSection }))
);

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: "#f5f0e6" }}>
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <CtaSection />
      <TestimonialsSection />
    </div>
  );
}
