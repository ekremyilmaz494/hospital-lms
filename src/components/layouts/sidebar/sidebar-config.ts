import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  GraduationCap,
  Users,
  Bell,
  History,
  Award,
  Calendar,
  UserCircle,
  BookOpen,
  ShieldCheck,
  Grid3x3,
  TrendingUp,
  Library,
  Star,
  ClipboardCheck,
  ClipboardList,
  Sparkles,
  Activity,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: { title: string; href: string }[];
  badge?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Geliştirme aşamasındaki modüller — müşteriye (demo/prod) kapalı.
// Tamamlanınca true yapılır veya NEXT_PUBLIC_ENABLE_BETA=true ile geçici açılır.
const BETA_MODULES_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BETA === 'true';

// ─────────────────────────────────────────────────────────
// SUPER ADMIN
// ─────────────────────────────────────────────────────────
export const superAdminNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'MÜŞTERİ YÖNETİMİ',
    items: [
      {
        title: 'Hastaneler',
        href: '/super-admin/hospitals',
        icon: Building2,
        children: [
          { title: 'Hastane Listesi', href: '/super-admin/hospitals' },
          { title: 'Yeni Hastane', href: '/super-admin/hospitals/new' },
        ],
      },
      { title: 'Abonelikler', href: '/super-admin/subscriptions', icon: CreditCard },
      { title: 'İçerik Kütüphanesi', href: '/super-admin/content-library', icon: Library },
    ],
  },
  {
    label: 'RAPORLAMA & DENETİM',
    items: [
      { title: 'Raporlar', href: '/super-admin/reports', icon: BarChart3 },
      { title: 'Audit Log', href: '/super-admin/audit-logs', icon: Shield },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { title: 'Sistem Sağlığı', href: '/super-admin/system-health', icon: Activity },
      { title: 'Ayarlar', href: '/super-admin/settings', icon: Settings },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// ADMIN — 4 mental grup (Genel / Eğitim / Personel / Uyum+Sistem)
// ─────────────────────────────────────────────────────────
export const adminNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'EĞİTİM & DEĞERLENDİRME',
    items: [
      {
        title: 'Eğitimler',
        href: '/admin/trainings',
        icon: GraduationCap,
        children: [
          { title: 'Eğitim Listesi', href: '/admin/trainings' },
          { title: 'Yeni Eğitim', href: '/admin/trainings/new' },
          { title: 'Kategori Yönetimi', href: '/admin/settings/categories' },
        ],
      },
      {
        title: 'Sınavlar',
        href: '/admin/exams',
        icon: ClipboardList,
        children: [
          { title: 'Sınav Listesi', href: '/admin/exams' },
          { title: 'Yeni Sınav', href: '/admin/exams/new' },
          { title: 'Soru Bankası', href: '/admin/exams/question-bank' },
        ],
      },
      { title: 'İçerik Kütüphanesi', href: '/admin/content-library', icon: Library },
      ...(BETA_MODULES_ENABLED
        ? [{ title: 'AI İçerik Stüdyosu', href: '/admin/ai-content-studio', icon: Sparkles, badge: 'Beta' } satisfies NavItem]
        : []),
    ],
  },
  {
    label: 'PERSONEL & YETKİNLİK',
    items: [
      {
        title: 'Personel',
        href: '/admin/staff',
        icon: Users,
        children: [
          { title: 'Personel Listesi', href: '/admin/staff' },
        ],
      },
      { title: 'Sertifikalar', href: '/admin/certificates', icon: Award },
      { title: 'Yetkinlik Matrisi', href: '/admin/competency-matrix', icon: Grid3x3 },
      {
        title: 'SMG Takibi',
        href: '/admin/smg',
        icon: Star,
        children: [
          { title: 'Genel Bakış', href: '/admin/smg' },
          { title: 'SKS Denetim Raporu', href: '/admin/smg/inspection' },
        ],
      },
    ],
  },
  {
    label: 'UYUM & RAPORLAMA',
    items: [
      { title: 'Uyum Raporu', href: '/admin/compliance', icon: ShieldCheck },
      { title: 'Etkinlik Analizi', href: '/admin/effectiveness', icon: TrendingUp },
      { title: 'Akreditasyon', href: '/admin/accreditation', icon: ClipboardCheck },
      {
        title: 'Geri Bildirim',
        href: '/admin/feedback-forms',
        icon: MessageSquare,
        children: [
          { title: 'Form Editörü', href: '/admin/feedback-forms' },
          { title: 'Yanıtlar', href: '/admin/feedback-forms/responses' },
          { title: 'Analitik', href: '/admin/feedback-forms/analytics' },
        ],
      },
      { title: 'Raporlar', href: '/admin/reports', icon: BarChart3 },
      { title: 'Bildirimler', href: '/admin/notifications', icon: Bell },
      { title: 'İşlem Geçmişi', href: '/admin/audit-logs', icon: History },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      {
        title: 'Ayarlar',
        href: '/admin/settings',
        icon: Settings,
        children: [
          { title: 'Genel Ayarlar', href: '/admin/settings' },
          ...(BETA_MODULES_ENABLED
            ? [{ title: 'Entegrasyonlar', href: '/admin/settings/integrations' }]
            : []),
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// STAFF — günlük kullanıcı, 2 grup yeter
// ─────────────────────────────────────────────────────────
export const staffNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
      { title: 'Eğitimlerim', href: '/staff/my-trainings', icon: BookOpen },
      { title: 'Sertifikalarım', href: '/staff/certificates', icon: Award },
      { title: 'SMG Puanlarım', href: '/staff/smg', icon: Star },
      { title: 'Takvim', href: '/staff/calendar', icon: Calendar },
      { title: 'Bildirimler', href: '/staff/notifications', icon: Bell },
    ],
  },
  {
    label: 'HESABIM',
    items: [
      { title: 'Profilim', href: '/staff/profile', icon: UserCircle },
    ],
  },
];
