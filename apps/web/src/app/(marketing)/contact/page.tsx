import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ContactClient } from "./contact-client";
// landing-3d tasarım dili (l3d-header/footer + token stilleri) bu sayfada da kullanılır.
import "@/app/landing-3d/landing-3d.css";

export const metadata: Metadata = {
  title: `Iletisim - ${BRAND.fullName}`,
  description: `${BRAND.fullName} ile iletisime gecin. Sorulariniz ve talepleriniz icin bize ulasin.`,
};

export default function ContactPage() {
  return <ContactClient />;
}
