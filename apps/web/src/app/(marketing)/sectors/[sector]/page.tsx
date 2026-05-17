import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { Sector } from '@/generated/prisma/enums'

// Faz 3 (2026-05-17): Sektör-bazlı marketing landing'leri. 5 sektör için minimal
// statik içerik — generateStaticParams ile build-time render edilir, dynamic'e
// düşmez. Içerik kopyaları pazarlama tarafından sonraki sprint'te genişletilir.
type SectorContent = {
  title: string
  tagline: string
  bullets: string[]
}

const SECTOR_CONTENT: Record<Sector, SectorContent> = {
  healthcare: {
    title: 'Sağlık Sektörü için LMS',
    tagline: 'SKS uyumlu eğitim, SMG takibi, otomatik sertifikasyon',
    bullets: [
      'SKS-EY standardına uygun eğitim ve denetim raporları',
      'SMG kategori-bazlı hekim aktivite puan takibi',
      'Sertifika geçerliliği + yenileme bildirimleri',
      'Hastane bölüm ve unvan hiyerarşisine göre atama',
    ],
  },
  manufacturing: {
    title: 'Üretim Sektörü için LMS',
    tagline: 'İSG, kalite ve operasyon eğitimleri tek panelde',
    bullets: [
      'İSG eğitim takvimi ve uyum raporları',
      'Vardiyalı personel için esnek atama',
      'Makina-bazlı yetkinlik matrisi',
      'ISO denetimleri için otomatik kayıt',
    ],
  },
  education: {
    title: 'Eğitim Kurumları için LMS',
    tagline: 'Öğretmen, idari personel ve hizmet sağlayıcılar için',
    bullets: [
      'Yıllık zorunlu eğitim takibi',
      'Branş bazlı içerik kütüphanesi',
      'Veli-okul iletişimi için bildirim',
      'MEB raporlama formatında çıktı',
    ],
  },
  retail: {
    title: 'Perakende için LMS',
    tagline: 'Mağaza zinciri eğitimleri ve operasyon standardizasyonu',
    bullets: [
      'Mağaza-bazlı eğitim atamaları',
      'Yeni ürün lansman eğitimi',
      'Müşteri deneyimi sertifikasyonu',
      'Hızlı onboarding akışı',
    ],
  },
  other: {
    title: 'Kurumunuz için LMS',
    tagline: 'Sektörden bağımsız personel eğitim platformu',
    bullets: [
      'Esnek rol ve yetki yapısı',
      'Özel içerik kütüphanesi',
      'Türkçe destek ve KVKK uyumu',
      'Hızlı kurulum, kredi kartı gerekmez',
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
  return {
    title: `${content.title} - ${BRAND.fullName}`,
    description: content.tagline,
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
    <div className="min-h-[80vh] px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {content.title}
          </h1>
          <p
            className="text-lg sm:text-xl"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {content.tagline}
          </p>
        </div>

        <div
          className="rounded-2xl p-6 sm:p-8 mb-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
          }}
        >
          <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            Sektörünüz için neler sunuyoruz
          </h2>
          <ul className="space-y-3">
            {content.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#0d9668' }} />
                <span style={{ color: 'var(--color-text-primary)' }}>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            prefetch={false}
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
            style={{ backgroundColor: '#0d9668' }}
          >
            Ücretsiz Deneyin
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            prefetch={false}
            href="/demo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            Demo Talep Edin
          </Link>
        </div>
      </div>
    </div>
  )
}
