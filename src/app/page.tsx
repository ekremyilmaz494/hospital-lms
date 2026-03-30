'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import {
  Shield, BarChart3, Video, Award,
  Clock, Users, CheckCircle2, ArrowRight, ChevronRight,
  Layers, Bell, FileText, Globe,
  Menu, X, Mail, Phone, MapPin, Star,
  ChevronDown, Monitor, Smartphone, PenTool,
  AlertTriangle,
  Play, BookOpen, Sparkles, Zap,
} from 'lucide-react'
import {
  motion,
  useScroll,
  useInView,
  useMotionValue,
  useMotionTemplate,
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
  {
    name: 'Başlangıç', price: '₺4.900', period: '/ay',
    desc: '50 personele kadar küçük klinikler',
    features: ['50 personel', '10 eğitim', '5 GB depolama', 'E-posta destek', 'Temel raporlar'],
    cta: 'Ücretsiz Dene', highlighted: false,
  },
  {
    name: 'Profesyonel', price: '₺12.900', period: '/ay',
    desc: '200 personele kadar orta ölçekli hastaneler',
    features: ['200 personel', 'Sınırsız eğitim', '50 GB depolama', 'Öncelikli destek', 'Gelişmiş raporlar', 'Sertifika özelleştirme', 'SCORM desteği'],
    cta: 'Ücretsiz Dene', highlighted: true,
  },
  {
    name: 'Kurumsal', price: 'Teklif Alın', period: '',
    desc: 'Zincir hastaneler ve büyük sağlık grupları',
    features: ['Sınırsız personel', 'Sınırsız eğitim', 'Sınırsız depolama', 'Özel destek yöneticisi', 'SSO / LDAP', 'HBYS entegrasyonu', 'On-premise seçeneği', 'SLA garantisi'],
    cta: 'İletişime Geçin', highlighted: false,
  },
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
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════
   SECTION LABEL — consistent eyebrow text
   ═══════════════════════════════════════════════ */

function SectionLabel({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border mb-3 ${
      dark
        ? 'bg-white/5 border-white/10 text-emerald-400'
        : 'bg-emerald-50 border-emerald-100 text-[#0d9668]'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? 'bg-emerald-400' : 'bg-[#0d9668]'}`} />
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MOCK DASHBOARD — Ürünü göstermek için CSS UI
   ═══════════════════════════════════════════════ */

function MockDashboard({ variant = 'admin' }: { variant?: 'admin' | 'staff' | 'exam' }) {
  if (variant === 'staff') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-8"><div className="h-5 w-48 rounded-md bg-slate-100 mx-auto" /></div>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <div className="h-5 w-36 rounded bg-slate-800 mb-1" />
            <div className="h-3 w-52 rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Enfeksiyon Kontrol', progress: 75, color: '#0d9668' },
              { title: 'İş Güvenliği', progress: 30, color: '#2563eb' },
              { title: 'Hasta Hakları', progress: 100, color: '#f59e0b' },
              { title: 'KVKK Eğitimi', progress: 0, color: '#8b5cf6' },
            ].map((t) => (
              <div key={t.title} className="rounded-lg border border-slate-100 p-3">
                <div className="h-2.5 w-20 rounded bg-slate-800 mb-2" />
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: t.color }} />
                </div>
                <div className="mt-1 text-[9px] text-slate-400 font-mono">%{t.progress}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'exam') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded font-mono">⏱ 14:32</span>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-1 text-[10px] font-semibold text-slate-400 font-mono">Soru 3 / 10</div>
          <div className="h-1 w-full rounded-full bg-slate-100 mb-3 overflow-hidden">
            <div className="h-full w-[30%] rounded-full bg-[#0d9668]" />
          </div>
          <div className="h-4 w-full rounded bg-slate-800 mb-3" />
          <div className="h-3 w-3/4 rounded bg-slate-200 mb-4" />
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((opt, i) => (
              <div key={opt} className={`flex items-center gap-2 rounded-lg border p-2.5 text-[10px] ${i === 1 ? 'border-[#0d9668] bg-emerald-50' : 'border-slate-100'}`}>
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${i === 1 ? 'border-[#0d9668]' : 'border-slate-200'}`}>
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
    <div className="rounded-xl border border-slate-200/60 bg-white shadow-2xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 bg-slate-50/80">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-8"><div className="h-5 w-48 rounded-md bg-slate-100 mx-auto" /></div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="w-12 border-r border-slate-100 bg-slate-50/50 py-3 flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-[#0d9668]" />
          <div className="h-px w-6 bg-slate-200" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-5 w-5 rounded bg-slate-100" />)}
        </div>
        {/* Main */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Personel', val: '247', color: '#0d9668' },
              { label: 'Eğitim', val: '12', color: '#2563eb' },
              { label: 'Tamamlanan', val: '%87', color: '#f59e0b' },
              { label: 'Geciken', val: '3', color: '#ef4444' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-100 p-2">
                <div className="text-[8px] text-slate-400 mb-0.5">{s.label}</div>
                <div className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-100 p-3 mb-3">
            <div className="h-2.5 w-24 rounded bg-slate-800 mb-3" />
            <div className="flex items-end gap-1 h-16">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i >= 10 ? '#0d9668' : '#e2e8f0' }} />
              ))}
            </div>
          </div>
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
  // ₺350: kişi başı eğitim maliyeti (eğitmen + salon + kayıp verimlilik)
  const costPerPersonPerTraining = 350
  const lmsCost = staff <= 50 ? 4900 : staff <= 200 ? 12900 : 24900
  const annualClassroom = staff * trainings * costPerPersonPerTraining
  const annualLMS = lmsCost * 12
  const savings = Math.max(0, annualClassroom - annualLMS)
  const pct = annualClassroom > 0 ? Math.round((savings / annualClassroom) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-10 shadow-sm">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label className="flex justify-between mb-3 text-sm font-semibold text-slate-700">
              Personel Sayısı
              <span className="text-[#0d9668] font-bold font-mono tabular-nums">{staff}</span>
            </label>
            <input type="range" min={20} max={500} step={10} value={staff} onChange={e => setStaff(+e.target.value)} className="landing-slider w-full" />
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>20</span><span>500</span>
            </div>
          </div>
          <div>
            <label className="flex justify-between mb-3 text-sm font-semibold text-slate-700">
              Yıllık Eğitim Sayısı
              <span className="text-[#0d9668] font-bold font-mono tabular-nums">{trainings}</span>
            </label>
            <input type="range" min={2} max={24} value={trainings} onChange={e => setTrainings(+e.target.value)} className="landing-slider w-full" />
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>2</span><span>24</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            * Hesaplama; eğitmen ücreti, salon gideri ve çalışan kayıp verimlilik maliyetlerini kapsar (kişi başı ₺350/eğitim).
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-100 p-4">
            <div>
              <p className="text-xs text-red-600/60 font-semibold mb-0.5">Sınıf İçi Yıllık Maliyet</p>
              <p className="text-xl font-bold text-red-600 font-mono">₺{annualClassroom.toLocaleString('tr-TR')}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <div>
              <p className="text-xs text-emerald-600/60 font-semibold mb-0.5">LMS Yıllık Maliyeti</p>
              <p className="text-xl font-bold text-emerald-600 font-mono">₺{annualLMS.toLocaleString('tr-TR')}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#0d9668] to-[#0b8058] p-4 text-white shadow-lg shadow-emerald-600/20">
            <p className="text-xs text-white/60 font-semibold mb-1">Yıllık Tasarruf</p>
            <p className="text-3xl font-extrabold font-mono tabular-nums">₺{savings.toLocaleString('tr-TR')}</p>
            <p className="text-sm text-white/60 mt-1 font-medium">%{pct} daha ucuz</p>
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
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left group"
      >
        <span className="text-base font-semibold text-slate-800 group-hover:text-[#0d9668] transition-colors pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#0d9668]' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-slate-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   HERO GRID BACKGROUND — Interactive spotlight
   ═══════════════════════════════════════════════ */

function HeroBackground() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    }
    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [mouseX, mouseY])

  const background = useMotionTemplate`
    radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(13, 150, 104, 0.10), transparent 80%)
  `

  return (
    <div ref={ref} className="pointer-events-auto absolute inset-0">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Static glows */}
      <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(13,150,104,0.08),transparent_65%)]" />
      <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(ellipse_at_100%_0%,rgba(37,99,235,0.05),transparent_65%)]" />
      {/* Mouse spotlight */}
      <motion.div className="absolute inset-0" style={{ background }} />
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
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 60))

  const NAV_LINKS = [
    { href: '#ozellikler', label: 'Özellikler' },
    { href: '#nasil-calisir', label: 'Nasıl Çalışır' },
    { href: '#fiyat', label: 'Fiyatlandırma' },
    { href: '#sss', label: 'SSS' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] selection:bg-[#0d9668]/20">

      {/* ━━━ 1. NAVBAR ━━━ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100'
          : 'bg-white/80 border-b border-slate-100 backdrop-blur-sm'
      }`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="shrink-0">
            <Image
              src="/devakent-logo.svg"
              alt="Devakent"
              width={130}
              height={36}
              priority
              className="transition-all duration-500"
            />
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-300"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors duration-300"
            >
              Giriş
            </Link>
            <Link
              href="/auth/login?demo=true"
              className="hidden sm:flex items-center gap-2 bg-[#0d9668] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#0b8058] transition-colors shadow-lg shadow-emerald-900/30"
            >
              Ücretsiz Dene <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-slate-600 transition-colors"
              aria-label="Menü"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <div className="px-5 py-4 flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 text-sm font-medium text-slate-600 border-b border-slate-50 last:border-0"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="py-2.5 rounded-lg text-sm font-medium text-slate-600 text-center border border-slate-200 hover:bg-slate-50 transition-colors">
                    Giriş Yap
                  </Link>
                  <Link href="/auth/login?demo=true" onClick={() => setMenuOpen(false)} className="bg-[#0d9668] text-white text-sm font-semibold py-3 rounded-lg text-center">
                    Ücretsiz Dene
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ━━━ 2. HERO — Dark, immersive ━━━ */}
      <section className="relative min-h-screen flex items-center pt-16 pb-20 overflow-hidden">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-6xl px-5 w-full">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">

            {/* Left: Copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-[#0d9668] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-7"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0d9668] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0d9668]" />
                </span>
                Türkiye&apos;nin Sağlık Sektörüne Özel LMS&apos;si
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold leading-[1.06] tracking-tight text-slate-900 mb-6"
              >
                Hastane personelini
                <br />
                <span className="bg-gradient-to-r from-[#34d399] via-[#10b981] to-[#38bdf8] bg-clip-text text-transparent">
                  eğit, sınav yap,
                </span>
                <br />
                sertifikalandır
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-[17px] text-slate-500 leading-relaxed mb-9 max-w-[480px]"
              >
                JCI ve ISO akreditasyon gereksinimlerini karşılayan çoklu hastane destekli LMS. Ön sınav → Video → Son sınav akışıyla ölçülebilir öğrenme.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap gap-3 mb-9"
              >
                <Link
                  href="/auth/login?demo=true"
                  className="group relative flex items-center gap-2 bg-[#0d9668] text-white px-7 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#0b8058] transition-all duration-300 hover:shadow-xl hover:shadow-emerald-900/40 overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  14 Gün Ücretsiz Deneyin
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#nasil-calisir"
                  className="flex items-center gap-2 border border-slate-200 bg-white px-6 py-3.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all duration-300"
                >
                  Nasıl Çalışır? <ChevronRight className="h-4 w-4" />
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                {['14 gün ücretsiz', 'Kredi kartı gerekmez', '5 dakikada kurulum'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-sm text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#0d9668]" />{item}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right: Product mockup with glow frame */}
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.75, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative"
            >
              {/* Outer glow */}
              <div className="absolute -inset-6 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(13,150,104,0.18),transparent_70%)]" />
              {/* Gradient border ring */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-[#0d9668]/40 via-[#0ea5e9]/10 to-transparent" />
              {/* Dashboard */}
              <div className="relative rounded-2xl overflow-hidden ring-1 ring-slate-200/80 shadow-2xl shadow-slate-900/10">
                <MockDashboard variant="admin" />
              </div>
              {/* Floating badge — bottom left */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-[#0d9668]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-800">247 sertifika</p>
                  <p className="text-[10px] text-slate-400">bu ay üretildi</p>
                </div>
              </motion.div>
              {/* Floating badge — top right */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-800">%94 uyum oranı</p>
                  <p className="text-[10px] text-slate-400">JCI hazırlığı</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#f8fafc] to-transparent pointer-events-none" />
      </section>

      {/* ━━━ 3. SOCIAL PROOF BAR ━━━ */}
      <section className="bg-white py-8 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />)}
                </div>
                <span className="text-xs font-bold text-slate-700">4.8/5</span>
                <div className="h-4 w-px bg-slate-200" />
                <span className="text-xs text-slate-400">45+ sağlık kuruluşu güveniyor</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {HOSPITAL_LOGOS.map((name) => (
                  <span key={name} className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-default">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 4. PROBLEM → ÇÖZÜM ━━━ */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center mb-14">
            <SectionLabel>Neden Devakent?</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Eskiyle kıyaslayın</h2>
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
            <Reveal>
              <div className="relative rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-8 lg:p-10 h-full overflow-hidden">
                <div className="absolute top-0 right-0 text-[140px] font-extrabold text-red-50 leading-none select-none pointer-events-none -translate-y-4 translate-x-4">✗</div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <h3 className="text-base font-bold text-red-900">Geleneksel Yöntemler</h3>
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
                        <X className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
                        <span className="text-sm text-red-800/65 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="relative rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-8 lg:p-10 h-full overflow-hidden">
                <div className="absolute top-0 right-0 text-[140px] font-extrabold text-emerald-50 leading-none select-none pointer-events-none -translate-y-4 translate-x-2">✓</div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-[#0d9668]" />
                    </div>
                    <h3 className="text-base font-bold text-emerald-900">Devakent ile</h3>
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
                        <span className="text-sm text-emerald-800/65 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ━━━ 5. NASIL ÇALIŞIR ━━━ */}
      <section id="nasil-calisir" className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center mb-16">
            <SectionLabel>Nasıl Çalışır</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">4 adımda eğitim yönetimi</h2>
          </Reveal>

          {/* Timeline */}
          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-[52px] left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((s, i) => (
                <Reveal key={s.step} delay={i * 0.09}>
                  <div className="relative bg-white rounded-2xl border border-slate-200/80 p-6 h-full group hover:border-[#0d9668]/25 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
                    {/* Step number — large decorative */}
                    <div className="absolute top-4 right-4 text-5xl font-extrabold text-slate-50 leading-none select-none font-mono group-hover:text-emerald-50 transition-colors">
                      {s.step}
                    </div>
                    <div className="relative">
                      <div className="h-10 w-10 rounded-xl bg-[#0d9668]/8 flex items-center justify-center mb-4 group-hover:bg-[#0d9668] transition-all duration-300 group-hover:shadow-lg group-hover:shadow-emerald-500/25">
                        <s.icon className="h-[18px] w-[18px] text-[#0d9668] group-hover:text-white transition-colors" strokeWidth={2} />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mb-2">{s.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 6. ÖZELLİKLER ━━━ */}
      <section id="ozellikler" className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center mb-14">
            <SectionLabel>Özellikler</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Sağlık sektörünün ihtiyaçlarına özel</h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-6 h-full hover:border-slate-300 hover:shadow-xl hover:shadow-slate-100/80 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                  {/* Subtle color glow on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}06, transparent 60%)` }} />
                  <div className="relative">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110" style={{ background: `${f.color}12` }}>
                      <f.icon className="h-5 w-5" style={{ color: f.color }} strokeWidth={1.8} />
                    </div>
                    <h3 className="text-[15px] font-bold text-slate-800 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 7. ÜRÜN ÖNİZLEME ━━━ */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center mb-10">
            <SectionLabel>Ürün Önizleme</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Platformu keşfedin</h2>
            <p className="text-base text-slate-500 max-w-md mx-auto">Üç farklı panel — yönetici, personel ve sınav ekranı.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 gap-1 shadow-sm">
                {([
                  { key: 'admin', label: 'Yönetici Paneli', icon: Monitor },
                  { key: 'staff', label: 'Personel Ekranı', icon: Smartphone },
                  { key: 'exam', label: 'Sınav Arayüzü', icon: PenTool },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setPreviewTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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

            <div className="max-w-2xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28 }}
                >
                  <MockDashboard variant={previewTab} />
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 8. STATS ━━━ */}
      <section className="relative py-16 lg:py-20 bg-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(13,150,104,0.06),transparent)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <div className="bg-white p-8 lg:p-10 text-center group hover:bg-emerald-50/40 transition-colors">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 mb-4 group-hover:border-[#0d9668]/30 group-hover:bg-[#0d9668]/10 transition-all mx-auto">
                    <s.icon className="h-5 w-5 text-[#0d9668]/50 group-hover:text-[#0d9668] transition-colors" strokeWidth={1.5} />
                  </div>
                  <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
                    <NumberTicker value={s.value} decimalPlaces={s.decimal ?? 0} className="font-extrabold text-slate-900" />
                    <span className="text-[#0d9668]">{s.suffix}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 font-medium">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ 9. TESTİMONYALLER ━━━ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center mb-14">
            <SectionLabel>Müşteri Yorumları</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Sağlık profesyonelleri ne diyor?</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <div className="relative rounded-2xl border border-slate-200/80 bg-white p-7 h-full flex flex-col overflow-hidden group hover:shadow-xl hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300">
                  {/* Large quote decoration */}
                  <div className="absolute -top-1 right-5 text-[80px] font-serif font-bold text-slate-50 leading-none select-none group-hover:text-emerald-50 transition-colors">&ldquo;</div>
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4 relative">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-6 relative">{t.quote}</p>
                  {/* Author */}
                  <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center text-sm font-bold text-[#0d9668] shrink-0">
                      {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.title} · {t.hospital}</p>
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
          <Reveal className="text-center mb-14">
            <SectionLabel>Fiyatlandırma</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Şeffaf fiyatlandırma</h2>
            <p className="text-base text-slate-500">14 gün ücretsiz deneme — kredi kartı gerekmez</p>
          </Reveal>

          <div className="grid lg:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.08}>
                <div className={`relative flex flex-col rounded-2xl p-7 h-full transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-[#0d9668] to-[#0b7a52] text-white shadow-2xl shadow-emerald-700/25 ring-1 ring-emerald-400/25 lg:scale-[1.03]'
                    : 'bg-white border border-slate-200/80 hover:shadow-xl hover:border-slate-300 hover:-translate-y-0.5'
                }`}>
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg shadow-amber-500/30">
                      En Popüler
                    </div>
                  )}

                  <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-5 ${plan.highlighted ? 'text-white/50' : 'text-slate-400'}`}>{plan.desc}</p>

                  <div className="mb-6">
                    <span className={`text-4xl font-extrabold font-mono ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
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
                    className={`block text-center py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      plan.highlighted
                        ? 'bg-white text-[#0d9668] hover:shadow-lg hover:shadow-emerald-900/20'
                        : 'bg-[#0d9668] text-white hover:bg-[#0b8058] hover:shadow-lg hover:shadow-emerald-500/20'
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
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-4xl px-5">
          <Reveal className="text-center mb-10">
            <SectionLabel>Yatırım Getirisi</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3">Tasarruf hesaplayıcı</h2>
            <p className="text-base text-slate-500">Dijital eğitime geçişle ne kadar tasarruf edeceğinizi görün.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <ROICalculator />
          </Reveal>
        </div>
      </section>

      {/* ━━━ 12. FAQ ━━━ */}
      <section id="sss" className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal className="text-center mb-12">
            <SectionLabel>SSS</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900">Sık sorulan sorular</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 px-6 shadow-sm">
              {FAQS.map((faq) => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 13. CTA — Green branded ━━━ */}
      <section className="relative py-20 lg:py-32 bg-[#0d9668] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_65%)]" />
          <div className="absolute top-0 right-1/3 h-[350px] w-[350px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_65%)]" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cta-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cta-grid)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-7">
              <Sparkles className="h-3 w-3 text-white" />
              14 gün ücretsiz · kredi kartı gerekmez
            </div>
            <h2 className="text-4xl lg:text-[56px] font-extrabold text-white leading-[1.05] tracking-tight mb-6">
              Hastane eğitimini<br />
              <span className="text-white/80">bugün dijitalleştirin</span>
            </h2>
            <p className="text-base text-white/70 mb-10 max-w-md mx-auto leading-relaxed">
              Binlerce sağlık profesyonelinin güvendiği platform. Kurulum gerektirmez, 5 dakikada başlayın.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
              <Link
                href="/auth/login?demo=true"
                className="group relative flex items-center justify-center gap-2 bg-white text-[#0d9668] px-8 py-4 rounded-xl text-sm font-bold hover:bg-white/90 transition-all duration-300 shadow-2xl shadow-black/20 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0d9668]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                Ücretsiz Demo Başlat
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#iletisim"
                className="px-7 py-4 rounded-xl text-sm font-bold text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                Bize Ulaşın
              </a>
            </div>
            <div className="flex justify-center flex-wrap gap-5 text-xs text-white/60">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-white/60" />Kredi kartı gerekmez</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-white/60" />5 dk kurulum</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-white/60" />İptal garantisi</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ 14. FOOTER ━━━ */}
      <footer id="iletisim" className="bg-slate-900 border-t border-white/[0.08]">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 mb-12">
            <div>
              <Image src="/devakent-logo.svg" alt="Devakent" width={110} height={30} className="brightness-0 invert opacity-55 mb-4" />
              <p className="text-sm text-white/35 leading-relaxed">Sağlık sektörüne özel personel eğitim ve sınav yönetim sistemi.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/25 mb-5">Ürün</h4>
              <ul className="space-y-3">
                {['Özellikler', 'Fiyatlandırma', 'Güvenlik', 'Entegrasyonlar'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-white/35 hover:text-white/65 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/25 mb-5">Şirket</h4>
              <ul className="space-y-3">
                {['Hakkımızda', 'Blog', 'Kariyer', 'İletişim'].map(l => (
                  <li key={l}><a href="#" className="text-sm text-white/35 hover:text-white/65 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/25 mb-5">İletişim</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5 text-sm text-white/35">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-white/20" />info@hastanelms.com
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white/35">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/20" />+90 (212) 555 0100
                </li>
                <li className="flex items-center gap-2.5 text-sm text-white/35">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-white/20" />İstanbul, Türkiye
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">© {new Date().getFullYear()} Devakent. Tüm hakları saklıdır.</p>
            <div className="flex gap-6">
              <Link href="/kvkk" className="text-xs text-white/20 hover:text-white/45 transition-colors">KVKK Aydınlatma</Link>
              <a href="#" className="text-xs text-white/20 hover:text-white/45 transition-colors">Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
