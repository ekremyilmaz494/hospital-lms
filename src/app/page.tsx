import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { HeroSection } from "./(landing)/hero-section";
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

const ScrollStorySection = dynamic(() =>
  import("@/components/landing/scroll-story-section").then((m) => ({
    default: m.ScrollStorySection,
  }))
);

const StatsSection = dynamic(() =>
  import("./(landing)/stats-section").then((m) => ({ default: m.StatsSection }))
);

const FeaturedTrainingsSection = dynamic(() =>
  import("@/components/landing/featured-trainings-section").then((m) => ({
    default: m.FeaturedTrainingsSection,
  }))
);

const FeaturesSection = dynamic(() =>
  import("./(landing)/features-section").then((m) => ({ default: m.FeaturesSection }))
);

const TrainingCatalogSection = dynamic(() =>
  import("./(landing)/training-catalog-section").then((m) => ({
    default: m.TrainingCatalogSection,
  }))
);

const CtaSection = dynamic(() =>
  import("./(landing)/cta-section").then((m) => ({ default: m.CtaSection }))
);

const FaqSection = dynamic(() =>
  import("./(landing)/faq-section").then((m) => ({ default: m.FaqSection }))
);

const TestimonialsSection = dynamic(() =>
  import("./(landing)/testimonials-section").then((m) => ({ default: m.TestimonialsSection }))
);

export default function LandingPage() {
  return (
    <div style={{ backgroundColor: "#f5f0e6" }}>
      <HeroSection />
      <ScrollStorySection />
      <StatsSection />
      <FeaturedTrainingsSection />
      <FeaturesSection />
      <TrainingCatalogSection />
      <CtaSection />
      <FaqSection />
      <TestimonialsSection />
    </div>
  );
}
