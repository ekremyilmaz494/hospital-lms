"use client";

import dynamic from "next/dynamic";

const HeroSection = dynamic(
  () => import("@/components/landing/hero-section").then((m) => ({ default: m.HeroSection })),
  { ssr: true }
);
const StatsSection = dynamic(
  () => import("@/components/landing/stats-section").then((m) => ({ default: m.StatsSection })),
  { ssr: true }
);
const FeaturesSection = dynamic(
  () => import("@/components/landing/features-section").then((m) => ({ default: m.FeaturesSection })),
  { ssr: true }
);
const CtaSection = dynamic(
  () => import("@/components/landing/cta-section").then((m) => ({ default: m.CtaSection })),
  { ssr: true }
);
const TestimonialsSection = dynamic(
  () => import("@/components/landing/testimonials-section").then((m) => ({ default: m.TestimonialsSection })),
  { ssr: true }
);

export function MarketingHomeClient() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <CtaSection />
      <TestimonialsSection />
    </>
  );
}
