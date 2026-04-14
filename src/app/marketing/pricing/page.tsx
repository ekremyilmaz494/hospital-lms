import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Fiyatlandirma - Hastane LMS",
  description: "Hastane LMS fiyat planlari. Baslangic, Profesyonel ve Kurumsal paketler ile hastanenize uygun cozum.",
};

export default function PricingPage() {
  return <PricingClient />;
}
