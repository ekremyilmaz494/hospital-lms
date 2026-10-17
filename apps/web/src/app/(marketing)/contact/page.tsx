import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = {
  title: `İletişim - ${BRAND.fullName}`,
  description: `${BRAND.fullName} ile iletişime geçin. Sorularınız ve talepleriniz için bize ulaşın.`,
};

export default function ContactPage() {
  return <ContactClient />;
}
