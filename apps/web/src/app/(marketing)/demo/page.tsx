import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: `Demo Talep Et - ${BRAND.fullName}`,
  description: `${BRAND.fullName} demo talebi. Ucretsiz demo ile platformu deneyimleyin.`,
};

export default function DemoPage() {
  return <DemoClient />;
}
