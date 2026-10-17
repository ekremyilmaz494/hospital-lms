import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/site/page-head";
import { BRAND } from "@/lib/brand";
import { pageMetadata } from "@/lib/site-metadata";
import { DemoClient } from "./demo-client";
// Form sayfası düzeni /iletisim ile ortak; tek dosyada tutulur.
import "../iletisim/form-page.css";

export const metadata: Metadata = pageMetadata({
  title: 'Demo Talep Edin',
  description:
    'KlinoVax\'ı hastanenizin eğitim senaryosuyla birlikte inceleyelim: atama, video, sınav, sertifika ve raporlama akışını canlı demoda görün.',
  path: '/demo',
});

const NEXT_STEPS = [
  {
    title: "Talebiniz bize ulaşır",
    desc: "Form bilgileriniz ekibimize iletilir ve kaydedilir.",
  },
  {
    title: "Sizinle iletişime geçeriz",
    desc: "Verdiğiniz e-posta adresi veya telefon numarası üzerinden size uygun bir demo zamanı belirleriz.",
  },
  {
    title: "Akışı birlikte inceleriz",
    desc: "Atama, video, sınav, sertifika ve raporlama adımlarını hastanenizin eğitim senaryosuna göre canlı olarak gösteririz.",
  },
] as const;

export default function DemoPage() {
  return (
    <>
      <PageHead breadcrumbPath="/demo"
        overline="Demo talebi"
        title="Platformu birlikte inceleyelim"
        lead="Formu doldurun, KlinoVax'ı hastanenizin eğitim senaryosu üzerinden canlı olarak gösterelim."
      />

      <div className="s-container s-page-body">
        <div className="s-formpage">
          <DemoClient />

          <aside className="s-formpage-aside" aria-label="Demo süreci hakkında">
            <section className="s-formpage-block" aria-labelledby="demo-sonra">
              <h2 id="demo-sonra" className="s-h3">
                Talebinizden sonra
              </h2>
              <ol className="s-formpage-steps">
                {NEXT_STEPS.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>{" "}
                    {step.desc}
                  </li>
                ))}
              </ol>
            </section>

            <section className="s-formpage-block s-formpage-rule" aria-labelledby="demo-veri">
              <h2 id="demo-veri" className="s-h3">
                Örnek verilerle gösterim
              </h2>
              <p>
                Demoda örnek veriler kullanılır. Kurumunuza ait gerçek personel bilgisi paylaşmanız
                gerekmez.
              </p>
              <p>Demo talebi herhangi bir taahhüt gerektirmez.</p>
            </section>

            <section className="s-formpage-block s-formpage-rule" aria-labelledby="demo-soru">
              <h2 id="demo-soru" className="s-h3">
                Önce bir sorunuz mu var?
              </h2>
              <p>
                <a href={`mailto:${BRAND.contact.email}`} className="s-formpage-link">
                  {BRAND.contact.email}
                </a>{" "}
                adresine yazabilir veya{" "}
                <Link href="/iletisim" className="s-formpage-link">
                  iletişim formunu
                </Link>{" "}
                kullanabilirsiniz.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
