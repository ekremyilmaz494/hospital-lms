import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { ContactClient } from "./contact-client";
// landing-3d tasarım dili (l3d-header/footer + token stilleri) bu sayfada da kullanılır.
import "@/app/landing-3d/landing-3d.css";

export const metadata: Metadata = pageMetadata({
  title: 'İletişim',
  description:
    'Demo, kurulum, KVKK ve teknik sorularınız için KlinoVax\'a e-posta veya telefonla ulaşın.',
  path: '/contact',
});

export default function ContactPage() {
  return <ContactClient />;
}
