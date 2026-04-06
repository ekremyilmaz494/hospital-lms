import type { Metadata } from "next";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = {
  title: "Iletisim - Hastane LMS",
  description: "Hastane LMS ile iletisime gecin. Sorulariniz ve talepleriniz icin bize ulasin.",
};

export default function ContactPage() {
  return <ContactClient />;
}
