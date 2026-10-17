import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { Header } from '@/components/landing-3d/header';
import { Footer } from '@/components/landing-3d/footer';
import { FounderCard } from '@/components/landing-3d/founder-card';
import '@/app/landing-3d/landing-3d.css';
import '@/app/landing-3d/landing-3d-about.css';

export const metadata: Metadata = {
  title: `Hakkımızda — ${BRAND.name}`,
  description: `${BRAND.name}, ${BRAND.legal.foundedYear} yılında Konya'da kurulan; hastane ve klinikler için personel eğitim, sınav ve uyum platformudur. Kurucu: ${BRAND.founder.name}.`,
  alternates: { canonical: '/hakkimizda', languages: { tr: '/hakkimizda', en: '/en' } },
  openGraph: {
    title: `Hakkımızda — ${BRAND.name}`,
    description: `${BRAND.legal.foundedYear}, Konya. Sağlık kurumları için personel eğitim, sınav ve uyum platformu.`,
    type: 'website',
    locale: 'tr_TR',
  },
};

const FACTS = [
  { label: 'Kuruluş', value: `${BRAND.legal.foundedYear} · Konya` },
  { label: 'Platform', value: 'Web · iOS · Android' },
  { label: 'Canlı kullanım', value: 'Özel Devakent Hastanesi' },
];

/** Ana sayfadaki ayrıntı bölümlerine bağlanan kartlar (hedef id'ler landing-3d içeriğinde tanımlıdır). */
const DETAIL_LINKS = [
  {
    href: '/#nasil-calisir',
    tag: 'SÜREÇ',
    title: 'Nasıl çalışır?',
    text: 'Kurumu hazırlamaktan raporlamaya kadar dört adımda tüm eğitim süreci.',
    cta: 'Adımları gör',
  },
  {
    href: '/#ozellikler',
    tag: 'ÖZELLİKLER',
    title: 'Neler sunuyoruz?',
    text: 'Eğitim, sınav, sertifika, raporlama ve personel deneyimi başlıklarında tüm özellikler.',
    cta: 'Özellikleri incele',
  },
  {
    href: '/#sss',
    tag: 'SSS',
    title: 'Aklınıza takılanlar',
    text: 'Deneme süresi, sınav kuralları, mobil uygulama ve KVKK süreçleri hakkında yanıtlar.',
    cta: 'Soruları oku',
  },
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
          <p className="l3d-about-lead">
            {`${BRAND.name}, sağlık kurumlarının personel eğitimini tek yerden yönetebilmesi için geliştirildi. `}
            Eğitimi bir kez yüklersiniz; atamayı, hatırlatmayı, sınavı, sertifikayı ve denetim
            raporlarını platform üstlenir.
          </p>
          <dl className="l3d-about-facts">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="l3d-about-features l3d-about-features--3" aria-label="Platformu keşfedin">
          {DETAIL_LINKS.map((d) => (
            <article key={d.href} className="l3d-about-feature">
              <span className="l3d-about-num">{d.tag}</span>
              <h2>{d.title}</h2>
              <p>{d.text}</p>
              <Link href={d.href} className="l3d-about-cta">
                {`${d.cta} →`}
              </Link>
            </article>
          ))}
        </section>

        <div className="l3d-about-grid">
          <div className="l3d-about-col">
            <section className="l3d-about-block" aria-labelledby="ne-yapiyoruz">
              <span className="l3d-about-num">01</span>
              <h2 id="ne-yapiyoruz">Ne yapıyoruz</h2>
              <p>
                {`${BRAND.name}, hastane ve klinikler için geliştirilmiş bir personel eğitim, sınav ve uyum platformudur. `}
                Yönetici eğitimi bir kez yükler; atamayı, hatırlatmayı, video izleme takibini,
                sınavı, sertifikayı ve denetime hazır raporları platform üstlenir.
              </p>
              <p>
                Videoda ileri sarma kilitlidir, izleme süresi sunucuda doğrulanır, ilerleme geri gitmez ve personel kaldığı
                yerden devam eder. Sınavı geçen personelin sertifikası otomatik oluşur; sertifikanın
                geçerlilik süresi eğitimin yenileme süresine göre belirlenir.
              </p>
              <p>
                Personel eğitimlerini vardiyasını bozmadan web üzerinden veya iOS ve Android
                uygulamasından tamamlar.
              </p>
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
