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
  Database,
  Award,
  Calendar,
  UserCircle,
  BookOpen,
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

export const superAdminNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
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
      { title: 'Raporlar', href: '/super-admin/reports', icon: BarChart3 },
      { title: 'Audit Log', href: '/super-admin/audit-logs', icon: Shield },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { title: 'Ayarlar', href: '/super-admin/settings', icon: Settings },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      {
        title: 'Eğitimler',
        href: '/admin/trainings',
        icon: GraduationCap,
        children: [
          { title: 'Eğitim Listesi', href: '/admin/trainings' },
          { title: 'Yeni Eğitim', href: '/admin/trainings/new' },
        ],
      },
      {
        title: 'Personel',
        href: '/admin/staff',
        icon: Users,
        children: [
          { title: 'Personel Listesi', href: '/admin/staff' },
        ],
      },
      { title: 'Sertifikalar', href: '/admin/certificates', icon: Award },
      { title: 'Raporlar', href: '/admin/reports', icon: BarChart3 },
      { title: 'Bildirimler', href: '/admin/notifications', icon: Bell },
      { title: 'İşlem Geçmişi', href: '/admin/audit-logs', icon: History },
      { title: 'Yedekleme', href: '/admin/backups', icon: Database },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { title: 'Ayarlar', href: '/admin/settings', icon: Settings },
    ],
  },
];

export const staffNav: NavGroup[] = [
  {
    items: [
      { title: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
      { title: 'Eğitimlerim', href: '/staff/my-trainings', icon: BookOpen },
      { title: 'Sertifikalarım', href: '/staff/certificates', icon: Award },
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
