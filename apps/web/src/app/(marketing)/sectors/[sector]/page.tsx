import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sector } from '@/generated/prisma/enums'
import { PageHead } from '@/components/site/page-head'

// Faz 3 (2026-05-17): Sektör-bazlı marketing landing'leri. generateStaticParams ile
// build-time render edilir. Sayfalar indekslenmez (hastane konumlandırmasını dağıtmasın);
// maddeler yalnız kodda doğrulanabilen genel yetenekleri anlatır (iddia politikası:
// akreditasyon/ISO/SMG/KVKK uyumu, hazır içerik, fiyat YOK).
type SectorContent = {
  title: string
  tagline: string
  bullets: string[]
}

const SECTOR_CONTENT: Record<Sector, SectorContent> = {
  healthcare: {
    title: 'Sağlık kurumları için eğitim platformu',
    tagline: 'Zorunlu eğitim, sınav, sertifika ve denetim belgeleri tek platformda.',
    bullets: [
      'Hastane birimi ve unvan yapısına göre eğitim ataması',
      'İleri sarılamayan video ve sunucuda doğrulanan izleme süresi',
      'Ön sınav, son sınav ve QR kodla doğrulanan sertifika',
      'Denetimde istenen formlar ve birim bazında uyum raporu',
    ],
  },
  manufacturing: {
    title: 'Üretim sektörü için eğitim platformu',
    tagline: 'Zorunlu ve operasyonel eğitimleri tek panelden yönetin.',
    bullets: [
      'Birime, unvana veya kişiye eğitim ataması',
      'Vardiyalı personel için web ve mobil uygulamadan erişim',
      'Son tarih yaklaşınca otomatik hatırlatma',
      'Tamamlanma ve sertifika takibi',
    ],
  },
  education: {
    title: 'Eğitim kurumları için eğitim platformu',
    tagline: 'Öğretmen ve idari personelin zorunlu eğitimlerini tek yerden takip edin.',
    bullets: [
      'Zorunlu eğitimlerin atanması ve takibi',
      'Kendi video, PDF ve ses içeriklerinizle eğitim hazırlama',
      'Ön sınav, son sınav ve otomatik sertifika',
      'Eksik eğitimler için hatırlatma',
    ],
  },
  retail: {
    title: 'Perakende için eğitim platformu',
    tagline: 'Mağaza ekiplerinin eğitimlerini standart bir akışta yürütün.',
    bullets: [
      'Birim bazlı eğitim atamaları',
      'Son tarih ve gecikme hatırlatmaları',
      'Mobil uygulamadan eğitim ve sınav',
      'Yeni personel için departman kuralıyla otomatik atama',
    ],
  },
  other: {
    title: 'Kurumunuz için eğitim platformu',
    tagline: 'Sektörden bağımsız personel eğitim ve sınav platformu.',
    bullets: [
      'Rol bazlı yetki yapısı',
      'Kendi eğitim içeriklerinizi yükleme',
      'KVKK süreçlerini destekleyen başvuru akışı',
      'Excel ile toplu personel aktarımı',
    ],
  },
}

export function generateStaticParams() {
  return (Object.keys(SECTOR_CONTENT) as Sector[]).map((sector) => ({ sector }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>
}): Promise<Metadata> {
  const { sector } = await params
  const content = SECTOR_CONTENT[sector as Sector]
  if (!content) return {}
  // Sektör sayfaları (üretim/eğitim/perakende) hastane konumlandırmasını dağıtıyor:
  // erişilebilir kalır ama indekslenmez. Yerine rol/hastane tipi çözüm sayfaları gelecek.
  return {
    title: content.title,
    description: content.tagline,
    robots: { index: false, follow: true },
  }
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ sector: string }>
}) {
  const { sector } = await params
  const content = SECTOR_CONTENT[sector as Sector]
  if (!content) notFound()

  return (
    <>
      <PageHead title={content.title} lead={content.tagline} />
      <section className="s-container s-page-body" aria-labelledby="sektor-sunulanlar">
        <div className="s-head">
          <h2 id="sektor-sunulanlar" className="s-h2">
            Sektörünüz için neler sunuyoruz
          </h2>
        </div>
        <ul className="s-checks">
          {content.bullets.map((bullet) => (
            <li key={bullet}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="s-cta-row">
          <Link href="/demo" className="s-btn s-btn-primary">
            Demo Talep Edin
          </Link>
          <Link href="/iletisim" className="s-btn s-btn-ghost">
            Bize yazın
          </Link>
        </div>
      </section>
    </>
  )
}
