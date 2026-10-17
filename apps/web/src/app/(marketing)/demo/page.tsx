import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: `Demo Talep Et - ${BRAND.fullName}`,
  description: `${BRAND.fullName} demo talebi. Kendi eğitim senaryonuzla platformu deneyimleyin; 30 günlük ücretsiz deneme sunuyoruz.`,
};

export default function DemoPage() {
  return <DemoClient />;
}
