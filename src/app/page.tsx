import dynamic from "next/dynamic";
import { HeroSection } from "./(landing)/hero-section";

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
