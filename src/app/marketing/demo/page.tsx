import type { Metadata } from "next";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: "Demo Talep Et - Hastane LMS",
  description: "Hastane LMS demo talebi. Ucretsiz demo ile platformu deneyimleyin.",
};

export default function DemoPage() {
  return <DemoClient />;
}
