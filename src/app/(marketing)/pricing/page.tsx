import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Fiyatlandirma - Devakent Hastanesi",
  description: "Devakent Hastanesi fiyat planlari. Baslangic, Profesyonel ve Kurumsal paketler ile hastanenize uygun cozum.",
};

export default function PricingPage() {
  return <PricingClient />;
}
