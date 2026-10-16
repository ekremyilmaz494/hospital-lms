import { pageMetadata } from "@/lib/site-metadata";
import type { Metadata } from "next";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = pageMetadata({
  title: 'Demo Talep Edin',
  description:
    'KlinoVax\'ı hastanenizin eğitim senaryosuyla birlikte inceleyelim: atama, video, sınav, sertifika ve raporlama akışını canlı demoda görün.',
  path: '/demo',
});

export default function DemoPage() {
  return <DemoClient />;
}
