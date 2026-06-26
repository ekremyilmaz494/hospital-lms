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
  Activity,
  MessageSquare,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Sector } from '@/generated/prisma/enums';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: { title: string; href: string }[];
  badge?: string;
  /** true → yalnızca Organization.ownerUserId === current user'a görünür */
  ownerOnly?: boolean;
  /**
   * Hangi sektörlerde gösterilsin. `undefined` → tüm sektörler (default).
   * Faz 3 sektör-agnostik refactor: sağlık-spesifik regülasyon kalemleri
   * (SMG, SKS uyum) sadece healthcare org'larda görünür.
   */
  sectors?: Sector[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Sektör-spesifik nav item'larını filtrele.
 * `sectors` tanımsız → tüm sektörlerde görünür (default).
 * Boş kalan group'lar (filtre sonrası 0 item) listeden düşer.
 */
export function filterNavBySector(groups: NavGroup[], sector: Sector): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.sectors || it.sectors.includes(sector)),
    }))
    .filter((g) => g.items.length > 0);
}

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
        title: 'Organizasyonlar',
        href: '/super-admin/organizations',
        icon: Building2,
        children: [
          { title: 'Organizasyon Listesi', href: '/super-admin/organizations' },
          { title: 'Yeni Organizasyon', href: '/super-admin/organizations/new' },
        ],
      },
      { title: 'Abonelikler', href: '/super-admin/subscriptions', icon: CreditCard },
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
          { title: 'Ek Hak Talepleri', href: '/admin/trainings/attempt-requests' },
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
      { title: 'Medya Kütüphanesi', href: '/admin/media-library', icon: Library },
      { title: 'Eğitim Dönemleri', href: '/admin/training-periods', icon: Calendar },
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
        sectors: ['healthcare'],
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
      { title: 'Uyum Raporu', href: '/admin/compliance', icon: ShieldCheck, sectors: ['healthcare'] },
      { title: 'Etkinlik Analizi', href: '/admin/effectiveness', icon: TrendingUp },
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
      // Yalnızca Esas Yönetici görür — sıradan admin'lerde gizli
      { title: 'Yönetici Yönetimi', href: '/admin/yoneticiler', icon: UserCog, ownerOnly: true },
      {
        title: 'Ayarlar',
        href: '/admin/settings',
        icon: Settings,
        children: [
          { title: 'Genel Ayarlar', href: '/admin/settings' },
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
      { title: 'SMG Puanlarım', href: '/staff/smg', icon: Star, sectors: ['healthcare'] },
      { title: 'Takvim', href: '/staff/calendar', icon: Calendar },
      { title: 'Bildirimler', href: '/staff/notifications', icon: Bell },
      { title: 'Geri Bildirimler', href: '/staff/feedback', icon: MessageSquare },
    ],
  },
  {
    label: 'HESABIM',
    items: [
      { title: 'Profilim', href: '/staff/profile', icon: UserCircle },
      { title: 'Değerlendirmeler', href: '/staff/evaluations', icon: ClipboardCheck },
      { title: 'Yetkinlik Sonuçlarım', href: '/staff/competency', icon: TrendingUp },
    ],
  },
];
