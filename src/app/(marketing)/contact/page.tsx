import type { Metadata } from "next";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = {
  title: "Iletisim - Devakent Hastanesi",
  description: "Devakent Hastanesi ile iletisime gecin. Sorulariniz ve talepleriniz icin bize ulasin.",
};

export default function ContactPage() {
  return <ContactClient />;
}
