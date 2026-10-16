import { pageMetadata } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { Header } from '@/components/landing-3d/header';
import { Footer } from '@/components/landing-3d/footer';
import { FounderCard } from '@/components/landing-3d/founder-card';
import '@/app/landing-3d/landing-3d.css';

export const metadata: Metadata = pageMetadata({
  title: 'Hakkımızda',
  description:
    'KlinoVax, 2026\'da Konya\'da kurulan, hastane ve sağlık kurumları için personel eğitim ve sınav platformudur. Kurucu: Ekrem Yılmaz.',
  path: '/hakkimizda',
});

const FACTS = [
  { label: 'Kuruluş', value: `${BRAND.legal.foundedYear} · Konya` },
  { label: 'Platform', value: 'Web · iOS · Android' },
  { label: 'Canlı kullanım', value: 'Özel Devakent Hastanesi' },
];

export default function AboutPage() {
  return (
    <div className="l3d-page" style={{ minHeight: '100vh' }}>
      {/* Statik künye (kullanıcı girdisi yok) — şirket doğrulaması için makine-okunur */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJsonLd('tr') }}
      />
      <Header alternateHref="/en#about" />
      {/* paddingTop INLINE — bkz. contact-client.tsx (fixed header çakışması) */}
      <main className="l3d-about" style={{ paddingTop: 'clamp(116px, 9vw, 140px)' }}>
        <section className="l3d-about-hero">
          <span className="l3d-eyebrow">HAKKIMIZDA</span>
          <h1 className="l3d-about-title">
            Hastane eğitimini
            <br />
            yazılıma devrediyoruz.
          </h1>
          <dl className="l3d-about-facts">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="l3d-about-grid">
          <div className="l3d-about-col">
            <section className="l3d-about-block" aria-labelledby="ne-yapiyoruz">
              <span className="l3d-about-num">01</span>
              <h2 id="ne-yapiyoruz">Ne yapıyoruz</h2>
              <p>
                {BRAND.name}; hastane, klinik ve eczaneler için uçtan uca personel eğitim ve sınav
                platformudur. Kurumun tek işi eğitimi yüklemek — atama, video izleme takibi, sınav,
                sertifika ve denetime hazır uyum raporlarını sistem otomatik üretir.
              </p>
              <p>Personel eğitimlerini web üzerinden veya mobil uygulamadan (iOS ve Android) tamamlar.</p>
            </section>

            <section className="l3d-about-block" aria-labelledby="kurulus">
              <span className="l3d-about-num">02</span>
              <h2 id="kurulus">Kuruluş</h2>
              <p>
                {/* Template literal: JSX'te ifade + Türkçe-karakterli metin arasındaki boşluk derlemede yutuluyordu */}
                {`${BRAND.name}, ${BRAND.legal.foundedYear} yılında Konya'da kuruldu. `}
                Bugün Özel Devakent Hastanesi&apos;nde canlı olarak kullanılıyor.
              </p>
            </section>

            <section className="l3d-about-block" aria-labelledby="iletisim">
              <span className="l3d-about-num">03</span>
              <h2 id="iletisim">İletişim</h2>
              <ul className="l3d-about-contact">
                <li>
                  <span>E-posta</span>
                  <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
                </li>
                <li>
                  <span>Konum</span>
                  {BRAND.contact.city}
                </li>
              </ul>
              <Link href="/contact" className="l3d-about-cta">
                İletişim formu →
              </Link>
            </section>
          </div>

          <aside className="l3d-about-aside" aria-label="Kurucu">
            <span className="l3d-eyebrow">KURUCU</span>
            <FounderCard locale="tr" />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
