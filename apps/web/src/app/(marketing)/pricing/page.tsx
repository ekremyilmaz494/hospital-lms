import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: `Fiyatlandirma - ${BRAND.fullName}`,
  description: `${BRAND.fullName} fiyat planlari. Baslangic, Profesyonel ve Kurumsal paketler ile kurumunuza uygun cozum.`,
};

export default function PricingPage() {
  return <PricingClient />;
}
