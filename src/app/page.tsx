'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import {
  GraduationCap, Shield, Building2, BarChart3, Video, Award,
  Clock, Users, CheckCircle2, ArrowRight, ChevronRight,
  Layers, Bell, FileText, Zap, Globe, Lock,
} from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'

function ROICalculator() {
  const [staffCount, setStaffCount] = useState(100)
  const [trainingsPerYear, setTrainingsPerYear] = useState(6)
  const classroomCostPerTraining = 2500
  const lmsCostMonthly = staffCount <= 50 ? 4900 : staffCount <= 200 ? 12900 : 24900
  const annualClassroom = staffCount * trainingsPerYear * (classroomCostPerTraining / staffCount)
  const annualLMS = lmsCostMonthly * 12
  const savings = Math.max(0, annualClassroom - annualLMS)
  const savingsPercent = annualClassroom > 0 ? Math.round((savings / annualClassroom) * 100) : 0

  return (
    <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Personel Sayısı: <span style={{ color: 'var(--color-primary)' }}>{staffCount}</span>
          </label>
          <input type="range" min={20} max={500} step={10} value={staffCount} onChange={e => setStaffCount(Number(e.target.value))} className="w-full accent-[#0d9668]" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Yıllık Eğitim Sayısı: <span style={{ color: 'var(--color-primary)' }}>{trainingsPerYear}</span>
          </label>
          <input type="range" min={2} max={24} step={1} value={trainingsPerYear} onChange={e => setTrainingsPerYear(Number(e.target.value))} className="w-full accent-[#0d9668]" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-error-bg)' }}>
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-error)' }}>Sınıf İçi Maliyet</p>
          <p className="mt-1 text-xl font-extrabold font-heading" style={{ color: 'var(--color-error)' }}>
            ₺{annualClassroom.toLocaleString('tr-TR')}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>/yıl</p>
        </div>
        <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-primary-light)' }}>
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-primary)' }}>LMS Maliyeti</p>
          <p className="mt-1 text-xl font-extrabold font-heading" style={{ color: 'var(--color-primary)' }}>
            ₺{annualLMS.toLocaleString('tr-TR')}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>/yıl</p>
        </div>
        <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-success-bg)' }}>
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-success)' }}>Yıllık Tasarruf</p>
          <p className="mt-1 text-xl font-extrabold font-heading" style={{ color: 'var(--color-success)' }}>
            ₺{savings.toLocaleString('tr-TR')}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>%{savingsPercent} daha ucuz</p>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Video,
    title: 'Video Tabanlı Eğitim',
    desc: 'İleri sarma engeliyle tam izleme garantisi. S3 + CloudFront ile kesintisiz streaming.',
    color: '#0d9668',
  },
  {
    icon: FileText,
    title: 'Ön Sınav → Video → Son Sınav',
    desc: 'Bilgi düzeyini ölç, eğitimi ver, tekrar ölç. Gelişimi somut verilerle kanıtla.',
    color: '#2563eb',
  },
  {
    icon: Award,
    title: 'Otomatik Sertifika',
    desc: 'QR kodlu, doğrulanabilir PDF sertifikalar. JCI ve ISO denetimleri için hazır.',
    color: '#f59e0b',
  },
  {
    icon: Bell,
    title: 'Akıllı Hatırlatmalar',
    desc: 'Deadline 3 gün kala, 1 gün kala ve gecikmelerde otomatik email + bildirim.',
    color: '#dc2626',
  },
  {
    icon: BarChart3,
    title: '360° Raporlama',
    desc: 'Departman bazlı uyum oranları, yetkinlik matrisi, eğitim etkinliği analizleri.',
    color: '#7c3aed',
  },
  {
    icon: Shield,
    title: 'KVKK & Güvenlik',
    desc: 'Row Level Security, rol bazlı erişim, veri silme başvurusu, audit log.',
    color: '#0891b2',
  },
]

const PLANS = [
  {
    name: 'Başlangıç',
    price: '₺4.900',
    period: '/ay',
    desc: '50 personele kadar küçük klinikler için',
    features: ['50 personel', '10 eğitim', '5 GB depolama', 'Email destek', 'Temel raporlar'],
    cta: 'Ücretsiz Dene',
    highlighted: false,
  },
  {
    name: 'Profesyonel',
    price: '₺12.900',
    period: '/ay',
    desc: '200 personele kadar orta ölçekli hastaneler',
    features: ['200 personel', 'Sınırsız eğitim', '50 GB depolama', 'Öncelikli destek', 'Gelişmiş raporlar', 'Sertifika özelleştirme', 'SCORM desteği'],
    cta: 'Ücretsiz Dene',
    highlighted: true,
  },
  {
    name: 'Kurumsal',
    price: 'Teklif Alın',
    period: '',
    desc: 'Zincir hastaneler ve büyük sağlık grupları',
    features: ['Sınırsız personel', 'Sınırsız eğitim', 'Sınırsız depolama', 'Özel destek yöneticisi', 'SSO / LDAP', 'HBYS entegrasyonu', 'On-premise seçeneği', 'SLA garantisi'],
    cta: 'İletişime Geçin',
    highlighted: false,
  },
]

const STATS = [
  { label: 'Aktif Hastane', value: 45 },
  { label: 'Eğitim Tamamlanan', value: 12800 },
  { label: 'Sertifika Üretilen', value: 9400 },
  { label: 'Çalışma Süresi', value: 99.9, suffix: '%', decimal: 1 },
]

export default function LandingPage() {
  const [demoLoading, setDemoLoading] = useState(false)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'var(--color-border)' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/devakent-logo.svg" alt="Devakent Hastanesi" width={140} height={38} priority />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Özellikler</a>
            <a href="#pricing" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Fiyatlandırma</a>
            <a href="#contact" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>İletişim</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold sm:inline-flex"
              style={{ color: 'var(--color-primary)' }}
            >
              Giriş Yap
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #0d9668, #065f46)' }}
            >
              Demo Başlat
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-20 -left-40 h-80 w-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #0d9668 0%, transparent 70%)' }} />
          <div className="absolute -right-20 bottom-20 h-60 w-60 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <BlurFade delay={0}>
              <div
                className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                <Zap className="h-3.5 w-3.5" />
                Türkiye&apos;nin Sağlık Sektörüne Özel LMS&apos;si
              </div>
            </BlurFade>

            <BlurFade delay={0.1}>
              <h1
                className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight font-heading md:text-5xl lg:text-6xl"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Hastane Personelinizi{' '}
                <span style={{ color: 'var(--color-primary)' }}>Eğitin, Sınav Yapın,</span>{' '}
                Sertifikalandırın
              </h1>
            </BlurFade>

            <BlurFade delay={0.2}>
              <p
                className="mx-auto mb-10 max-w-xl text-lg leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                JCI ve ISO akreditasyon gereksinimlerini karşılayan, çoklu hastane destekli eğitim yönetim sistemi. Ön sınav → Video → Son sınav akışıyla ölçülebilir öğrenme.
              </p>
            </BlurFade>

            <BlurFade delay={0.3}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/auth/login?demo=true"
                  className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #0d9668 0%, #065f46 100%)',
                    boxShadow: '0 8px 30px rgba(13, 150, 104, 0.35)',
                  }}
                >
                  14 Gün Ücretsiz Deneyin
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  Nasıl Çalışır?
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </BlurFade>
          </div>

          {/* Stats bar */}
          <BlurFade delay={0.45}>
            <div
              className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4"
            >
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border p-5 text-center"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="text-2xl font-extrabold font-heading" style={{ color: 'var(--color-primary)' }}>
                    <NumberTicker value={s.value} decimalPlaces={s.decimal ?? 0} className="font-heading font-extrabold" style={{ color: 'var(--color-primary)' }} />
                    {s.suffix ?? ''}
                  </div>
                  <div className="mt-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20" style={{ background: 'var(--color-surface)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <BlurFade delay={0}>
            <div className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight font-heading" style={{ color: 'var(--color-text-primary)' }}>
                4 Adımda Eğitim Yönetimi
              </h2>
              <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                Eğitim oluştur, ata, takip et, raporla — hepsi tek platformda
              </p>
            </div>
          </BlurFade>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: '01', icon: Layers, title: 'Eğitim Oluştur', desc: 'Video yükle, sorular hazırla, geçme notunu belirle' },
              { step: '02', icon: Users, title: 'Personele Ata', desc: 'Departman veya kişi bazlı toplu atama yap' },
              { step: '03', icon: Video, title: 'İzle & Sınav Ol', desc: 'Ön sınav → Video izleme → Son sınav akışı' },
              { step: '04', icon: Award, title: 'Sertifika Al', desc: 'Başarılı personele QR kodlu sertifika otomatik üretilir' },
            ].map((item, i) => (
              <BlurFade key={item.step} delay={0.1 * i}>
                <div
                  className="group relative rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="absolute top-5 right-5 text-3xl font-extrabold font-heading" style={{ color: 'var(--color-border)' }}>
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-base font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.desc}
                  </p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <BlurFade delay={0}>
            <div className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight font-heading" style={{ color: 'var(--color-text-primary)' }}>
                Neden Hastane LMS?
              </h2>
              <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                Sağlık sektörünün ihtiyaçlarına özel tasarlandı
              </p>
            </div>
          </BlurFade>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <BlurFade key={f.title} delay={0.08 * i}>
                <div
                  className="group rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${f.color}15`, color: f.color }}
                  >
                    <f.icon className="h-5.5 w-5.5" strokeWidth={1.8} />
                  </div>
                  <h3 className="mb-2 text-[0.95rem] font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.desc}
                  </p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <section className="border-y py-12" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { icon: Shield, label: 'KVKK Uyumlu' },
              { icon: Lock, label: 'ISO 27001' },
              { icon: Globe, label: 'JCI Hazır' },
              { icon: Clock, label: '7/24 Erişim' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-2 text-center">
                <b.icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} strokeWidth={1.5} />
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <BlurFade delay={0}>
            <div className="mb-14 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight font-heading" style={{ color: 'var(--color-text-primary)' }}>
                Şeffaf Fiyatlandırma
              </h2>
              <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                14 gün ücretsiz deneme — kredi kartı gerekmez
              </p>
            </div>
          </BlurFade>

          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <BlurFade key={plan.name} delay={0.1 * i}>
                <div
                  className="relative flex flex-col rounded-2xl border p-7"
                  style={{
                    background: plan.highlighted
                      ? 'linear-gradient(180deg, rgba(13,150,104,0.04) 0%, var(--color-surface) 100%)'
                      : 'var(--color-surface)',
                    borderColor: plan.highlighted ? 'var(--color-primary)' : 'var(--color-border)',
                    borderWidth: plan.highlighted ? '2px' : '1px',
                  }}
                >
                  {plan.highlighted && (
                    <div
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold text-white"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      En Popüler
                    </div>
                  )}
                  <h3 className="mb-1 text-lg font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                    {plan.name}
                  </h3>
                  <p className="mb-5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {plan.desc}
                  </p>
                  <div className="mb-6">
                    <span className="text-3xl font-extrabold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                      {plan.price}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {plan.period}
                    </span>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.highlighted ? '/auth/login?demo=true' : '#contact'}
                    className="block rounded-xl py-3 text-center text-sm font-bold transition-transform hover:-translate-y-0.5"
                    style={{
                      background: plan.highlighted ? 'var(--color-primary)' : 'transparent',
                      color: plan.highlighted ? 'white' : 'var(--color-primary)',
                      border: plan.highlighted ? 'none' : '1.5px solid var(--color-primary)',
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI HESAPLAYICI ── */}
      <section className="py-20" style={{ background: 'var(--color-surface)' }}>
        <div className="mx-auto max-w-3xl px-6">
          <BlurFade delay={0}>
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight font-heading" style={{ color: 'var(--color-text-primary)' }}>
                Yatırım Getirisi Hesaplayıcı
              </h2>
              <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                Dijital eğitim sistemine geçişle ne kadar tasarruf edeceğinizi hesaplayın
              </p>
            </div>
          </BlurFade>
          <ROICalculator />
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="py-20"
        style={{ background: 'linear-gradient(135deg, #0d9668 0%, #065f46 50%, #0f4a35 100%)' }}
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <BlurFade delay={0}>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white font-heading md:text-4xl">
              Hastane Eğitim Yönetimini Dijitalleştirin
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-white/80">
              14 gün boyunca tüm özellikleri ücretsiz deneyin. Kurulum gerektirmez, hemen başlayın.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/login?demo=true"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ color: '#0d9668' }}
              >
                Ücretsiz Demo Başlat
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:info@hastanelms.com"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Bize Ulaşın
              </a>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-12" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-3">
                <Image src="/devakent-logo.svg" alt="Devakent Hastanesi" width={120} height={32} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Sağlık sektörüne özel personel eğitim ve sınav yönetim sistemi.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ürün</h4>
              <ul className="space-y-2">
                {['Özellikler', 'Fiyatlandırma', 'Güvenlik', 'Entegrasyonlar'].map(l => (
                  <li key={l}><a href="#" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Şirket</h4>
              <ul className="space-y-2">
                {['Hakkımızda', 'Blog', 'Kariyer', 'İletişim'].map(l => (
                  <li key={l}><a href="#" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div id="contact">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İletişim</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <li>info@hastanelms.com</li>
                <li>+90 (212) 555 0100</li>
                <li>İstanbul, Türkiye</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              © {new Date().getFullYear()} Devakent Hastanesi. Tüm hakları saklıdır.
            </p>
            <div className="flex gap-6">
              <Link href="/kvkk" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>KVKK Aydınlatma</Link>
              <a href="#" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
