import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { Sector } from '@/generated/prisma/enums'

// Sektör-bazlı pazarlama sayfaları. generateStaticParams ile build-time render edilir.
// Yalnızca sağlık sayfası dizine alınır (sitemap'te); diğer sektörler robots noindex'tir.
// İçerik yalnızca koda dayanan, doğrulanmış ürün özelliklerini içerir.
type SectorContent = {
  eyebrow: string
  title: string
  tagline: string
  intro: string
  bullets: string[]
}

const SECTOR_CONTENT: Record<Sector, SectorContent> = {
  healthcare: {
    eyebrow: 'SAĞLIK KURUMLARI',
    title: 'Sağlık kurumları için personel eğitimi',
    tagline: 'SKS belgeleri ve sertifika yenileme hatırlatmaları tek platformda.',
    intro:
      'Hastane ve klinikler için tasarlanan KlinoVax, eğitimin atanmasından denetim belgelerine kadar tüm süreci tek yerden yürütür. Zorunlu eğitimlerin kimde tamamlandığını, kimde eksik kaldığını her an görürsünüz.',
    bullets: [
      'SKS için eğitim katılım (imza) çizelgesini ve eğitim duyuru formunu PDF olarak alırsınız.',
      'Sertifikaya yenileme süresi tanımlarsınız; süre dolmadan personele hatırlatma gider.',
      'Atamayı departman, alt birim veya kişi bazında yaparsınız.',
      'Uyum raporunda zorunlu eğitimlerin tamamlanma durumunu departman ve eğitim bazında görürsünüz.',
      'Sertifikaları PDF olarak dışa aktarabilirsiniz.',
    ],
  },
  manufacturing: {
    eyebrow: 'ÜRETİM',
    title: 'Üretim tesisleri için personel eğitimi',
    tagline: 'Vardiyalı çalışanlar eğitimini telefonundan tamamlar; yetkinlikleri tek tabloda izlersiniz.',
    intro:
      'Farklı vardiyalarda çalışan personele aynı eğitimi ulaştırmak ve kimin neyi tamamladığını izlemek için gereken adımları KlinoVax tek yerde toplar.',
    bullets: [
      'Vardiyalı çalışanlar için iOS ve Android uygulamasından eğitim ve sınav.',
      'Personel ve eğitim kesişimini gösteren yetkinlik matrisi.',
      'Excel ile toplu personel aktarımı: önizleme ve geri alma desteğiyle.',
      'Sertifika takibi ve bitiş hatırlatmaları.',
    ],
  },
  education: {
    eyebrow: 'EĞİTİM KURUMLARI',
    title: 'Eğitim kurumları için personel eğitimi',
    tagline: 'Öğretmen, idari ve yardımcı personelin zorunlu eğitimleri yıllık dönemlerle takip edilir.',
    intro:
      'Yıllık eğitim dönemleri, ön ve son sınavlar ile sertifikalar aynı panelde yönetilir; raporları PDF veya Excel olarak dışa aktarabilirsiniz.',
    bullets: [
      'Yıllık eğitim dönemleriyle zorunlu eğitim takibi.',
      'Departman, alt birim veya kişi bazında eğitim ataması.',
      'Excel ile soru bankası içe aktarma.',
      'Raporlarda PDF ve Excel dışa aktarım.',
    ],
  },
  retail: {
    eyebrow: 'PERAKENDE',
    title: 'Perakende için personel eğitimi',
    tagline: 'Departman ve alt birimlere göre atama yapın; çalışanlar eğitimini mobilde tamamlasın.',
    intro:
      'Çok sayıda çalışanı olan ve vardiyayla işleyen yapılarda eğitimi atamak, takip etmek ve belgelemek için KlinoVax kullanılabilir.',
    bullets: [
      'Departman ve alt birim bazında eğitim atamaları.',
      'Vardiyalı çalışanlar için mobil eğitim.',
      'Excel ile toplu personel aktarımı.',
      'Sertifika takibi ve bitiş hatırlatmaları.',
    ],
  },
  other: {
    eyebrow: 'TÜM KURUMLAR',
    title: 'Kurumunuz için personel eğitimi',
    tagline: 'Eğitimi yükleyin, atayın, sınavla ölçün ve sertifikalandırın.',
    intro:
      'Sektörünüz ne olursa olsun, eğitimi sıfırdan kurmadan başlayabileceğiniz bir akış sunuyoruz. Kurumunuzda 30 gün ücretsiz deneyebilirsiniz.',
    bullets: [
      'Video, PDF ve ses içeriklerle eğitim hazırlama.',
      'Ön ve son sınav, geçme notu ve deneme hakkı ayarları.',
      'Sertifika ve raporlar: PDF ve Excel dışa aktarım.',
      'KVKK süreçlerine destek: veri sahibi başvuru yönetimi, aydınlatma metni onayı ve kuruma özel saklama süreleri.',
    ],
  },
}

const INDEXED_SECTORS: readonly Sector[] = ['healthcare']

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
  const indexed = INDEXED_SECTORS.includes(sector as Sector)
  return {
    title: `${content.title} - ${BRAND.fullName}`,
    description: content.tagline,
    ...(indexed ? {} : { robots: { index: false, follow: true } }),
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
    <div className="px-6 pb-20 pt-6 sm:pb-24 lg:pt-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <span className="l3d-eyebrow">{content.eyebrow}</span>
          <h1
            className="mb-4 mt-3 font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: 'var(--landing-ink)',
            }}
          >
            {content.title}
          </h1>
          <p
            className="mx-auto max-w-2xl text-lg leading-relaxed"
            style={{ color: 'var(--landing-ink-soft)' }}
          >
            {content.tagline}
          </p>
        </div>

        <div
          className="mb-8 rounded-2xl border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--landing-surface)',
            borderColor: 'var(--landing-rule)',
            boxShadow: 'var(--landing-shadow-card)',
          }}
        >
          <p className="mb-6 leading-relaxed" style={{ color: 'var(--landing-ink-soft)' }}>
            {content.intro}
          </p>
          <h2
            className="mb-5 text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--landing-ink)' }}
          >
            Neler sunuyoruz
          </h2>
          <ul className="space-y-3">
            {content.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 flex-shrink-0"
                  style={{ color: 'var(--landing-brand)' }}
                  aria-hidden="true"
                />
                <span style={{ color: 'var(--landing-ink)' }}>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link prefetch={false} href="/register" className="l3d-cta gap-2">
            30 Gün Ücretsiz Deneyin
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            prefetch={false}
            href="/demo"
            className="inline-flex items-center justify-center rounded-full border px-7 py-3.5 text-[15px] font-semibold transition-colors hover:bg-[var(--landing-surface)]"
            style={{
              color: 'var(--landing-ink)',
              borderColor: 'var(--landing-rule-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Demo Talep Edin
          </Link>
        </div>
      </div>
    </div>
  )
}
