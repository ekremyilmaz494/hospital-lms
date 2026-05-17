import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SiteNav } from "@/components/landing/site-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingMotionProvider } from "@/components/landing/landing-motion-provider";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.shortDesc}`,
  description: BRAND.longDesc,
  openGraph: {
    title: `${BRAND.name} — ${BRAND.shortDesc}`,
    description: BRAND.longDesc,
    type: "website",
    locale: "tr_TR",
  },
};

const PromoVideoSection = dynamic(() =>
  import("@/components/landing/promo-video-section").then((m) => ({
    default: m.PromoVideoSection,
  }))
);

const TrustBar = dynamic(() =>
  import("@/components/landing/trust-bar").then((m) => ({ default: m.TrustBar }))
);

const ScrollStorySection = dynamic(() =>
  import("@/components/landing/scroll-story-section").then((m) => ({
    default: m.ScrollStorySection,
  }))
);

const IndustryShowcase = dynamic(() =>
  import("@/components/landing/industry-showcase").then((m) => ({
    default: m.IndustryShowcase,
  }))
);

const FeaturesSection = dynamic(() =>
  import("@/components/landing/features-section").then((m) => ({ default: m.FeaturesSection }))
);

const ProofSection = dynamic(() =>
  import("@/components/landing/proof-section").then((m) => ({ default: m.ProofSection }))
);

const CtaSection = dynamic(() =>
  import("@/components/landing/cta-section").then((m) => ({ default: m.CtaSection }))
);

const FaqSection = dynamic(() =>
  import("@/components/landing/faq-section").then((m) => ({ default: m.FaqSection }))
);

const SiteFooter = dynamic(() =>
  import("@/components/landing/site-footer").then((m) => ({ default: m.SiteFooter }))
);

export default function LandingPage() {
  return (
    <LandingMotionProvider>
      <div style={{ backgroundColor: "var(--landing-bg)" }}>
        <SiteNav />
        <HeroSection />
        <PromoVideoSection />
        <TrustBar />
        <ScrollStorySection />
        <IndustryShowcase />
        <FeaturesSection />
        <ProofSection />
        <CtaSection />
        <FaqSection />
        <SiteFooter />
      </div>
    </LandingMotionProvider>
  );
}
