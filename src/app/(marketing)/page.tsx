"use client";

import { HeroSection } from "@/components/landing/hero-section";
import { StatsSection } from "@/components/landing/stats-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";

export default function MarketingHomePage() {
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
