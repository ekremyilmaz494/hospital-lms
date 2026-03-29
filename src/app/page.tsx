'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef } from 'react'
import {
  Shield, BarChart3, Video, Award,
  Clock, Users, CheckCircle2, ArrowRight, ChevronRight,
  Layers, Bell, FileText, Globe,
  Menu, X, Mail, Phone, MapPin, Star,
  ChevronDown, Monitor, Smartphone, PenTool,
  AlertTriangle,
  Play, BookOpen, Sparkles,
} from 'lucide-react'
import {
  motion,
  useScroll,
  useInView,
  useMotionValueEvent,
  AnimatePresence,
} from 'framer-motion'
import { NumberTicker } from '@/components/ui/number-ticker'

/* ═══════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════ */

const FEATURES = [
  { icon: Video, title: 'Video Tabanlı Eğitim', desc: 'İleri sarma engeliyle tam izleme garantisi. CloudFront CDN ile kesintisiz streaming.', color: '#0d9668' },
  { icon: FileText, title: 'Ön Sınav → Video → Son Sınav', desc: 'Bilgi düzeyini ölç, eğitimi ver, tekrar ölç. Gelişimi somut verilerle kanıtla.', color: '#2563eb' },
  { icon: Award, title: 'Otomatik Sertifika', desc: 'QR kodlu, doğrulanabilir PDF sertifikalar. JCI ve ISO denetimleri için hazır.', color: '#f59e0b' },
  { icon: Bell, title: 'Akıllı Hatırlatmalar', desc: 'Deadline yaklaşınca ve gecikmelerde otomatik e-posta + uygulama içi bildirim.', color: '#ef4444' },
  { icon: BarChart3, title: '360° Raporlama', desc: 'Departman bazlı uyum oranları, yetkinlik matrisi, eğitim etkinliği analizleri.', color: '#8b5cf6' },
  { icon: Shield, title: 'KVKK & Güvenlik', desc: 'Row Level Security, rol bazlı erişim, denetim kayıtları ve veri silme başvurusu.', color: '#06b6d4' },
]

const PLANS = [
  { name: 'Başlangıç', price: '₺4.900', period: '/ay', desc: '50 personele kadar küçük klinikler', features: ['50 personel', '10 eğitim', '5 GB depolama', 'E-posta destek', 'Temel raporlar'], cta: 'Ücretsiz Dene', highlighted: false },
  { name: 'Profesyonel', price: '₺12.900', period: '/ay', desc: '200 personele kadar orta ölçekli hastaneler', features: ['200 personel', 'Sınırsız eğitim', '50 GB depolama', 'Öncelikli destek', 'Gelişmiş raporlar', 'Sertifika özelleştirme', 'SCORM desteği'], cta: 'Ücretsiz Dene', highlighted: true },
  { name: 'Kurumsal', price: 'Teklif Alın', period: '', desc: 'Zincir hastaneler ve büyük sağlık grupları', features: ['Sınırsız personel', 'Sınırsız eğitim', 'Sınırsız depolama', 'Özel destek yöneticisi', 'SSO / LDAP', 'HBYS entegrasyonu', 'On-premise seçeneği', 'SLA garantisi'], cta: 'İletişime Geçin', highlighted: false },
]

const STATS = [
  { label: 'Aktif Hastane', value: 45, suffix: '+', icon: Globe },
  { label: 'Tamamlanan Eğitim', value: 12800, suffix: '+', icon: BookOpen },
  { label: 'Üretilen Sertifika', value: 9400, suffix: '+', icon: Award },
  { label: 'Çalışma Süresi', value: 99.9, suffix: '%', decimal: 1, icon: Clock },
]

const STEPS = [
  { step: '01', icon: Layers, title: 'Eğitim Oluştur', desc: 'Video yükle, soruları hazırla, geçme notunu belirle.' },
  { step: '02', icon: Users, title: 'Personele Ata', desc: 'Departman veya kişi bazlı toplu atama yap.' },
  { step: '03', icon: Play, title: 'İzle & Sınav Ol', desc: 'Ön sınav → Video izleme → Son sınav akışı.' },
  { step: '04', icon: Award, title: 'Sertifika Al', desc: 'QR kodlu sertifika otomatik üretilir.' },
]

const TESTIMONIALS = [
  { name: 'Dr. Elif Kaya', title: 'Eğitim Koordinatörü', hospital: 'Ankara Şehir Hastanesi', quote: 'Devakent ile yıllık zorunlu eğitimlerin tamamlanma oranı %62\'den %94\'e çıktı. Artık denetim zamanı stres yaşamıyoruz.', rating: 5 },
  { name: 'Mehmet Yıldırım', title: 'Başhemşire', hospital: 'Memorial Sağlık Grubu', quote: 'Personelimiz artık mesai saatleri dışında da eğitimlere erişebiliyor. Sınıf içi eğitimlere kıyasla %40 maliyet tasarrufu sağladık.', rating: 5 },
  { name: 'Ayşe Demir', title: 'Kalite Müdürü', hospital: 'Medicana International', quote: 'JCI akreditasyonu için gereken tüm eğitim kayıtlarını tek tıkla raporlayabiliyoruz. Denetçiler çok etkilendi.', rating: 5 },
]

const FAQS = [
  { q: 'Ücretsiz deneme nasıl çalışır?', a: '14 gün boyunca tüm özelliklere tam erişim sağlarsınız. Kredi kartı gerekmez. Deneme sonunda beğenirseniz plan seçersiniz, beğenmezseniz hiçbir ücret alınmaz.' },
  { q: 'Mevcut HBYS sistemimizle entegre olur mu?', a: 'Evet. REST API üzerinden tüm hastane bilgi sistemleriyle entegre olabilir. SSO/LDAP desteği ile tek giriş noktası sağlanır.' },
  { q: 'KVKK\'ya uyumlu mu?', a: 'Tamamen uyumlu. Row Level Security, veri silme başvurusu (KVKK Madde 11), denetim kayıtları, veri şifreleme ve erişim logları mevcut.' },
  { q: 'Kaç personel destekleniyor?', a: 'Başlangıç planında 50, Profesyonel\'de 200 personel desteklenir. Kurumsal planda sınır yoktur. Binlerce kullanıcıya ölçeklenebilir.' },
  { q: 'Video eğitim içeriklerini nasıl yüklerim?', a: 'Sürükle-bırak ile video yükleyin. MP4, WebM ve MOV desteklenir. 5 GB\'a kadar tek dosya. CloudFront CDN ile kesintisiz streaming.' },
  { q: 'Teknik destek sunuyor musunuz?', a: 'Tüm planlarda e-posta desteği mevcuttur. Profesyonel ve Kurumsal planlarda öncelikli destek ve özel destek yöneticisi atanır.' },
]

const HOSPITAL_LOGOS = [
  'Ankara Şehir Hastanesi', 'Memorial Sağlık', 'Medicana', 'Acıbadem', 'Florence Nightingale', 'Liv Hospital',
]

/* ═══════════════════════════════════════════════
   UTILITY: Scroll-triggered reveal
   ═══════════════════════════════════════════════ */

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════
   MOCK DASHBOARD — Ürünü göstermek için CSS UI
   ═══════════════════════════════════════════════ */

function MockDashboard({ variant = 'admin' }: { variant?: 'admin' | 'staff' | 'exam' }) {
  if (variant === 'staff') {
    return (
      <div className="mock-ui rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
          <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400" /><div className="h-2.5 w-2.5 rounded-full bg-green-400" /></div>
          <div className="flex-1 mx-8"><div className="h-5 w-48 rounded-md bg-slate-100 mx-auto" /></div>
        </div>
        <div className="p-5">
          <div className="mb-4"><div className="h-5 w-36 rounded bg-slate-800 mb-1" /><div className="h-3 w-52 rounded bg-slate-200" /></div>
          {/* Training cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Enfeksiyon Kontrol', progress: 75, color: '#0d9668' },
              { title: 'İş Güvenliği', progress: 30, color: '#2563eb' },
              { title: 'Hasta Hakları', progress: 100, color: '#f59e0b' },
              { title: 'KVKK Eğitimi', progress: 0, color: '#8b5cf6' },
            ].map((t) => (
              <div key={t.title} className="rounded-lg border border-slate-100 p-3">
                <div className="h-3 w-full rounded bg-slate-100 mb-2" />
                <div className="h-2.5 w-20 rounded bg-slate-800 mb-2 text-[0]">{t.title}</div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.progress}%`, background: t.color }} />
                </div>
                <div className="mt-1 text-[9px] text-slate-400">%{t.progress}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'exam') {
    return (
      <div className="mock-ui rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
          <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400" /><div className="h-2.5 w-2.5 rounded-full bg-green-400" /></div>
          <div className="flex-1 text-center"><span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">⏱ 14:32</span></div>
        </div>
        <div className="p-5">
          <div className="mb-1 text-[10px] font-semibold text-slate-400">Soru 3 / 10</div>
          <div className="h-4 w-full rounded bg-slate-800 mb-3" />
          <div className="h-3 w-3/4 rounded bg-slate-200 mb-4" />
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((opt, i) => (
              <div key={opt} className={`flex items-center gap-2 rounded-lg border p-2.5 text-[10px] ${i === 1 ? 'border-[#0d9668] bg-emerald-50' : 'border-slate-100'}`}>
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${i === 1 ? 'border-[#0d9668]' : 'border-slate-200'}`}>
                  {i === 1 && <div className="h-2 w-2 rounded-full bg-[#0d9668]" />}
                </div>
                <div className="h-2.5 rounded bg-slate-200 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Admin dashboard (default)
  return (
    <div className="mock-ui rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
        <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400" /><div className="h-2.5 w-2.5 rounded-full bg-green-400" /></div>
        <div className="flex-1 mx-8"><div className="h-5 w-48 rounded-md bg-slate-100 mx-auto" /></div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="w-12 border-r border-slate-100 bg-slate-50/50 py-3 flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-[#0d9668]" />
          <div className="h-1 w-4 rounded bg-slate-200" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-5 w-5 rounded bg-slate-100" />)}
        </div>
        {/* Main content */}
        <div className="flex-1 p-4">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Personel', val: '247', color: '#0d9668' },
              { label: 'Eğitim', val: '12', color: '#2563eb' },
              { label: 'Tamamlanan', val: '%87', color: '#f59e0b' },
              { label: 'Geciken', val: '3', color: '#ef4444' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-100 p-2">
                <div className="text-[8px] text-slate-400 mb-0.5">{s.label}</div>
                <div className="text-sm font-bold" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Chart placeholder */}
          <div className="rounded-lg border border-slate-100 p-3 mb-3">
            <div className="h-2.5 w-24 rounded bg-slate-800 mb-3" />
            <div className="flex items-end gap-1 h-16">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i >= 10 ? '#0d9668' : '#e2e8f0' }} />
              ))}
            </div>
          </div>
          {/* Table rows */}
          <div className="space-y-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50/50 px-3 py-2">
                <div className="h-5 w-5 rounded-full bg-slate-200" />
                <div className="h-2.5 w-20 rounded bg-slate-200" />
                <div className="h-2.5 w-16 rounded bg-slate-100 ml-auto" />
                <div className="h-4 w-12 rounded-full bg-emerald-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   ROI CALCULATOR
   ═══════════════════════════════════════════════ */

function ROICalculator() {
  const [staff, setStaff] = useState(100)
  const [trainings, setTrainings] = useState(6)
  const classroomCost = 2500
  const lmsCost = staff <= 50 ? 4900 : staff <= 200 ? 12900 : 24900
  const annualClassroom = staff * trainings * (classroomCost / staff)
  const annualLMS = lmsCost * 12
  const savings = Math.max(0, annualClassroom - annualLMS)
  const pct = annualClassroom > 0 ? Math.round((savings / annualClassroom) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label className="flex justify-between mb-2 text-sm font-medium text-slate-700">Personel Sayısı<span className="text-[#0d9668] font-bold">{staff}</span></label>
            <input type="range" min={20} max={500} step={10} value={staff} onChange={e => setStaff(+e.target.value)} className="landing-slider w-full" />
          </div>
          <div>
            <label className="flex justify-between mb-2 text-sm font-medium text-slate-700">Yıllık Eğitim<span className="text-[#0d9668] font-bold">{trainings}</span></label>
            <input type="range" min={2} max={24} value={trainings} onChange={e => setTrainings(+e.target.value)} className="landing-slider w-full" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-red-50 p-4">
            <div><p className="text-xs text-red-600/60 font-medium">Sınıf İçi Maliyet</p><p className="text-xl font-bold text-red-600">₺{annualClassroom.toLocaleString('tr-TR')}<span className="text-xs font-normal text-red-400">/yıl</span></p></div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
            <div><p className="text-xs text-emerald-600/60 font-medium">LMS Maliyeti</p><p className="text-xl font-bold text-emerald-600">₺{annualLMS.toLocaleString('tr-TR')}<span className="text-xs font-normal text-emerald-400">/yıl</span></p></div>
          </div>
          <div className="rounded-xl bg-[#0d9668] p-4 text-white">
            <p className="text-xs text-white/60 font-medium">Yıllık Tasarruf</p>
            <p className="text-2xl font-extrabold">₺{savings.toLocaleString('tr-TR')} <span className="text-sm font-medium text-white/70">(%{pct} daha ucuz)</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   FAQ ITEM
   ═══════════════════════════════════════════════ */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full py-5 text-left group">
        <span className="text-base font-semibold text-slate-800 group-hover:text-[#0d9668] transition-colors pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <p className="pb-5 text-sm leading-relaxed text-slate-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<'admin' | 'staff' | 'exam'>('admin')

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 20))

  const NAV_LINKS = [
    { href: '#ozellikler', label: 'Özellikler' },
    { href: '#nasil-calisir', label: 'Nasıl Çalışır' },
    { href: '#fiyat', label: 'Fiyatlandırma' },
    { href: '#sss', label: 'SSS' },
  ]

  return (
    <div className="min-h-screen bg-white selection:bg-[#0d9668]/10">

      {/* ━━━ 1. NAVBAR ━━━ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-lg shadow-sm border-b border-slate-100' : 'bg-white'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/">
            <Image src="/devakent-logo.svg" alt="Devakent" width={130} height={36} priority />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Giriş</Link>
            <Link href="/auth/login?demo=true" className="hidden sm:flex items-center gap-2 bg-[#0d9668] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#0b8058] transition-colors">
              Ücretsiz Dene <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-600" aria-label="Menü">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden bg-white border-t border-slate-100 overflow-hidden">
              <div className="px-5 py-4 flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="py-3 text-sm text-slate-600">{l.label}</a>
                ))}
                <Link href="/auth/login?demo=true" onClick={() => setMenuOpen(false)} className="mt-2 bg-[#0d9668] text-white text-sm font-semibold py-3 rounded-lg text-center">
                  Ücretsiz Dene
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ━━━ 2. HERO ━━━ */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 bg-emerald-50 text-[#0d9668] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Türkiye&apos;nin Sağlık Sektörüne Özel LMS&apos;si
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-[1.1] tracking-tight text-slate-900 mb-6">
                Hastane personelinizi
                <span className="text-[#0d9668]"> eğitin, sınav yapın, </span>
                sertifikalandırın
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                JCI ve ISO akreditasyon gereksinimlerini karşılayan, çoklu hastane destekli eğitim yönetim sistemi. Ön sınav → Video → Son sınav akışıyla ölçülebilir öğrenme.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-wrap gap-3 mb-8">
                <Link href="/auth/login?demo=true" className="group flex items-center gap-2 bg-[#0d9668] text-white px-7 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#0b8058] transition-all hover:shadow-lg hover:shadow-emerald-500/20">
                  14 Gün Ücretsiz Deneyin <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#nasil-calisir" className="flex items-center gap-2 border border-slate-200 px-6 py-3.5 rounded-lg text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all">
                  Nasıl Çalışır? <ChevronRight className="h-4 w-4" />
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0d9668]" />14 gün ücretsiz</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0d9668]" />Kredi kartı gerekmez</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#0d9668]" />5 dakikada kurulum</span>
              </motion.div>
            </div>

            {/* Right: Product screenshot */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-emerald-100/40 via-transparent to-blue-100/30 rounded-2xl blur-2xl" />
                <div className="relative"><MockDashboard variant="admin" /></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━ 3. SOCIAL PROOF BAR ━━━ */}
      <section className="py-10 border-y border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-400">45+ sağlık kuruluşu güveniyor</span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />)}
                  <span className="text-xs font-semibold text-slate-600 ml-1">4.8/5</span>
                </div>
              </div>
              <div className="flex items-center gap-8">
                {HOSPITAL_LOGOS.map((name) => (
                  <span key={name} className="text-xs font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap hidden sm:block">{name}</span>
                ))}
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider sm:hidden">6+ Hastane Zinciri</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 4. PROBLEM → ÇÖZÜM ━━━ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <Reveal>
              <div className="rounded-2xl border border-red-100 bg-red-50/50 p-8 lg:p-10 h-full">
                <div className="flex items-center gap-2 mb-6">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-bold text-red-900">Geleneksel Eğitim Yönetimi</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Excel tablolarıyla personel takibi, dosya karmaşası',
                    'Sınıf içi eğitimler: yüksek maliyet, zaman kaybı',
                    'Denetim raporları hazırlamak günler alıyor',
                    'Sertifika geçerlilikleri takip edilemiyor',
                    'Personel eğitimi tamamladı mı belli değil',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-red-800/70">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8 lg:p-10 h-full">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="h-5 w-5 text-[#0d9668]" />
                  <h3 className="text-lg font-bold text-emerald-900">Devakent ile</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Tek platformda dijital eğitim, sınav ve sertifika',
                    'Video tabanlı eğitim: her yerden, her zaman erişim',
                    'Anlık uyum raporları, tek tıkla denetim hazırlığı',
                    'Otomatik sertifika yenileme hatırlatmaları',
                    'Gerçek zamanlı ilerleme takibi ve bildirimler',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-[#0d9668] mt-0.5 shrink-0" />
                      <span className="text-sm text-emerald-800/70">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ━━━ 5. NASIL ÇALIŞIR ━━━ */}
      <section id="nasil-calisir" className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Nasıl Çalışır</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">4 adımda eğitim yönetimi</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.08}>
                <div className="relative bg-white rounded-2xl border border-slate-200/80 p-6 h-full group hover:border-[#0d9668]/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-10 -right-3 w-6 border-t-2 border-dashed border-slate-200 z-10" />
                  )}
                  <div className="text-4xl font-extrabold text-slate-100 mb-4 group-hover:text-emerald-100 transition-colors">{s.step}</div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-[#0d9668]/10 flex items-center justify-center group-hover:bg-[#0d9668] transition-colors">
                      <s.icon className="h-4.5 w-4.5 text-[#0d9668] group-hover:text-white transition-colors" strokeWidth={2} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{s.title}</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 6. ÖZELLİKLER — Bento Grid ━━━ */}
      <section id="ozellikler" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Özellikler</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Sağlık sektörünün ihtiyaçlarına özel</h2>
            </div>
          </Reveal>

          {/* Bento layout: 2 big + 4 small */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06} className={i < 2 ? 'lg:col-span-1 lg:row-span-1' : ''}>
                <div className="group rounded-2xl border border-slate-200/80 bg-white p-6 h-full hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300" style={{ background: `${f.color}12` }}>
                    <f.icon className="h-5 w-5 transition-colors" style={{ color: f.color }} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 7. ÜRÜN ÖNİZLEME — Tabbed ━━━ */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Ürün Önizleme</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Platformu keşfedin</h2>
              <p className="text-base text-slate-500 max-w-md mx-auto">Üç farklı panel — yönetici, personel ve sınav ekranı.</p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {/* Tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 gap-1">
                {([
                  { key: 'admin', label: 'Yönetici Paneli', icon: Monitor },
                  { key: 'staff', label: 'Personel Ekranı', icon: Smartphone },
                  { key: 'exam', label: 'Sınav Arayüzü', icon: PenTool },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setPreviewTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      previewTab === tab.key
                        ? 'bg-[#0d9668] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="max-w-2xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <MockDashboard variant={previewTab} />
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 8. STATS ━━━ */}
      <section className="py-16 lg:py-20 bg-[#0d9668]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <div className="text-center">
                  <s.icon className="h-6 w-6 text-white/30 mx-auto mb-3" strokeWidth={1.5} />
                  <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                    <NumberTicker value={s.value} decimalPlaces={s.decimal ?? 0} className="font-extrabold text-white" />
                    <span className="text-white/70">{s.suffix}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 9. TESTİMONİYALLER ━━━ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Müşteri Yorumları</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Sağlık profesyonelleri ne diyor?</h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />)}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-[#0d9668]/10 flex items-center justify-center text-sm font-bold text-[#0d9668]">
                      {t.name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.title}, {t.hospital}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 10. FİYATLANDIRMA ━━━ */}
      <section id="fiyat" className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Fiyatlandırma</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Şeffaf Fiyatlandırma</h2>
              <p className="text-base text-slate-500">14 gün ücretsiz deneme — kredi kartı gerekmez</p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.08}>
                <div className={`relative flex flex-col rounded-2xl p-7 h-full transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-[#0d9668] text-white shadow-xl shadow-emerald-500/15 ring-1 ring-emerald-400/20 lg:scale-[1.02]'
                    : 'bg-white border border-slate-200/80 hover:shadow-lg hover:border-slate-300'
                }`}>
                  {plan.highlighted && <div className="absolute -top-3 left-7 bg-[#f59e0b] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">En Popüler</div>}

                  <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-5 ${plan.highlighted ? 'text-white/50' : 'text-slate-400'}`}>{plan.desc}</p>

                  <div className="mb-6">
                    <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    {plan.period && <span className={`text-sm ${plan.highlighted ? 'text-white/50' : 'text-slate-400'}`}>{plan.period}</span>}
                    {plan.period && <p className={`text-xs mt-0.5 ${plan.highlighted ? 'text-white/30' : 'text-slate-400'}`}>KDV hariç</p>}
                  </div>

                  <ul className="flex-1 space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-white/50' : 'text-[#0d9668]'}`} />
                        <span className={plan.highlighted ? 'text-white/70' : 'text-slate-500'}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.name === 'Kurumsal' ? '#iletisim' : '/auth/login?demo=true'}
                    className={`block text-center py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
                      plan.highlighted
                        ? 'bg-white text-[#0d9668] hover:shadow-lg'
                        : 'bg-[#0d9668] text-white hover:bg-[#0b8058]'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 11. ROI ━━━ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-5">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Yatırım Getirisi</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Tasarruf hesaplayıcı</h2>
              <p className="text-base text-slate-500">Dijital eğitime geçişle ne kadar tasarruf edeceğinizi görün.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <ROICalculator />
          </Reveal>
        </div>
      </section>

      {/* ━━━ 12. FAQ ━━━ */}
      <section id="sss" className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-[#0d9668] mb-2">Sık Sorulan Sorular</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Merak edilenler</h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 px-6">
              {FAQS.map((faq) => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 13. CTA ━━━ */}
      <section className="py-20 lg:py-28 bg-[#0a0e14]">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight mb-5">
              Hastane eğitim yönetimini<br />dijitalleştirin
            </h2>
            <p className="text-base text-white/40 mb-8 max-w-md mx-auto">14 gün boyunca tüm özellikleri ücretsiz deneyin. Kurulum gerektirmez.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link href="/auth/login?demo=true" className="group flex items-center justify-center gap-2 bg-[#0d9668] text-white px-8 py-4 rounded-lg text-sm font-semibold hover:bg-[#0b8058] transition-all">
                Ücretsiz Demo Başlat <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#iletisim" className="px-7 py-4 rounded-lg text-sm font-semibold text-white/60 border border-white/10 hover:bg-white/5 transition-all">
                Bize Ulaşın
              </a>
            </div>
            <div className="flex justify-center gap-5 text-xs text-white/25">
              <span>Kredi kartı gerekmez</span><span>·</span><span>5 dk kurulum</span><span>·</span><span>İptal garantisi</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 14. FOOTER ━━━ */}
      <footer id="iletisim" className="bg-[#0a0e14] border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Image src="/devakent-logo.svg" alt="Devakent" width={110} height={30} className="brightness-0 invert opacity-50 mb-4" />
              <p className="text-sm text-white/20 leading-relaxed">Sağlık sektörüne özel personel eğitim ve sınav yönetim sistemi.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-4">Ürün</h4>
              <ul className="space-y-2.5">{['Özellikler','Fiyatlandırma','Güvenlik','Entegrasyonlar'].map(l=><li key={l}><a href="#" className="text-sm text-white/25 hover:text-white/50 transition-colors">{l}</a></li>)}</ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-4">Şirket</h4>
              <ul className="space-y-2.5">{['Hakkımızda','Blog','Kariyer','İletişim'].map(l=><li key={l}><a href="#" className="text-sm text-white/25 hover:text-white/50 transition-colors">{l}</a></li>)}</ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-4">İletişim</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm text-white/25"><Mail className="h-3.5 w-3.5" />info@hastanelms.com</li>
                <li className="flex items-center gap-2 text-sm text-white/25"><Phone className="h-3.5 w-3.5" />+90 (212) 555 0100</li>
                <li className="flex items-center gap-2 text-sm text-white/25"><MapPin className="h-3.5 w-3.5" />İstanbul, Türkiye</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/15">© {new Date().getFullYear()} Devakent. Tüm hakları saklıdır.</p>
            <div className="flex gap-6">
              <Link href="/kvkk" className="text-xs text-white/15 hover:text-white/30 transition-colors">KVKK Aydınlatma</Link>
              <a href="#" className="text-xs text-white/15 hover:text-white/30 transition-colors">Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
