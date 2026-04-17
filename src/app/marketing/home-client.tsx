"use client";

import { HeroSection } from "../(landing)/hero-section";
import { StatsSection } from "../(landing)/stats-section";
import { FeaturesSection } from "../(landing)/features-section";
import { CtaSection } from "../(landing)/cta-section";
import { TestimonialsSection } from "../(landing)/testimonials-section";

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
