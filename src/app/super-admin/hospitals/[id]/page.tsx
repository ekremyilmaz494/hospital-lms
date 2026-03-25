'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Users, GraduationCap, TrendingUp,
  Edit, Ban, CheckCircle, CreditCard, Calendar, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';

// Mock data
const hospital = {
  id: '1',
  name: 'Devakent Hastanesi',
  code: 'DEV001',
  address: 'Devakent Mah. Sağlık Cad. No: 42, Ankara',
  phone: '+90 (312) 555 12 34',
  email: 'info@devakent.com',
  logoUrl: null,
  isActive: true,
  isSuspended: false,
  createdAt: '22.03.2026',
  plan: 'Kurumsal',
  planStatus: 'active',
  expiresAt: '22.03.2027',
  staffCount: 245,
  trainingCount: 32,
  completionRate: 87.3,
};

const admins = [
  { id: '1', name: 'Dr. Ahmet Yılmaz', email: 'ahmet@devakent.com', lastLogin: '24.03.2026' },
  { id: '2', name: 'Fatma Demir', email: 'fatma@devakent.com', lastLogin: '23.03.2026' },
];

const recentActivity = [
  { action: 'Yeni eğitim oluşturuldu', detail: 'Enfeksiyon Kontrol Eğitimi', time: '2 saat önce', user: 'Dr. Ahmet Yılmaz' },
  { action: '15 personele eğitim atandı', detail: 'İş Güvenliği Eğitimi', time: '5 saat önce', user: 'Fatma Demir' },
  { action: 'Personel eklendi', detail: 'Mehmet Kara', time: '1 gün önce', user: 'Dr. Ahmet Yılmaz' },
  { action: 'Sınav tamamlandı', detail: '12 personel başarılı', time: '2 gün önce', user: 'Sistem' },
];

export default function HospitalDetailPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-bold text-white" style={{ background: 'var(--color-primary)' }}>
              DE
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              {hospital.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{hospital.code}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                Aktif
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                {hospital.plan}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Edit className="h-4 w-4" /> Düzenle
          </Button>
          <Button variant="outline" className="gap-2 text-red-500" style={{ borderColor: 'var(--color-border)' }}>
            <Ban className="h-4 w-4" /> Askıya Al
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Toplam Personel" value={hospital.staffCount} icon={Users} accentColor="var(--color-primary)" />
        <StatCard title="Aktif Eğitim" value={hospital.trainingCount} icon={GraduationCap} accentColor="var(--color-accent)" />
        <StatCard title="Tamamlanma Oranı" value={`${hospital.completionRate}%`} icon={TrendingUp} accentColor="var(--color-success)" />
        <StatCard title="Abonelik Bitiş" value={hospital.expiresAt} icon={Calendar} accentColor="var(--color-info)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hospital Info + Subscription */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>İletişim Bilgileri</h3>
            <div className="space-y-3 text-sm">
              <div><span style={{ color: 'var(--color-text-muted)' }}>Adres:</span><p style={{ color: 'var(--color-text-primary)' }}>{hospital.address}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Telefon:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{hospital.phone}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>E-posta:</span><p style={{ color: 'var(--color-text-primary)' }}>{hospital.email}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Kayıt Tarihi:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{hospital.createdAt}</p></div>
            </div>
          </div>

          {/* Admin Users */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Admin Kullanıcılar</h3>
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-accent)' }}>
                      {admin.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{admin.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{admin.email}</p>
                  </div>
                  <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{admin.lastLogin}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Activity className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                Son Aktiviteler
              </h3>
            </div>
            <div className="space-y-4">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex gap-4 border-l-2 pl-4" style={{ borderColor: idx === 0 ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.action}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.detail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{item.user}</span>
                      <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>• {item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
