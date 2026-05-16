import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = {
  title: `Iletisim - ${BRAND.fullName}`,
  description: `${BRAND.fullName} ile iletisime gecin. Sorulariniz ve talepleriniz icin bize ulasin.`,
};

export default function ContactPage() {
  return <ContactClient />;
}
