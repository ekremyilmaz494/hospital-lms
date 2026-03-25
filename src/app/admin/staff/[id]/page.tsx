'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, User, GraduationCap, TrendingUp, Calendar, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';

const staff = {
  name: 'Elif Kaya', email: 'elif@devakent.com', tcNo: '12345678901',
  department: 'Hemşirelik', title: 'Baş Hemşire', phone: '+90 (555) 123 45 67',
  initials: 'EK',
};

const trainingHistory = [
  { title: 'Enfeksiyon Kontrol', attempt: 1, preScore: 65, postScore: 92, status: 'passed', date: '15.03.2026' },
  { title: 'İş Güvenliği Temel', attempt: 1, preScore: 70, postScore: 88, status: 'passed', date: '10.03.2026' },
  { title: 'Hasta Hakları', attempt: 1, preScore: 80, postScore: 95, status: 'passed', date: '20.02.2026' },
  { title: 'El Hijyeni', attempt: 1, preScore: 75, postScore: 90, status: 'passed', date: '15.02.2026' },
  { title: 'Radyoloji Güvenlik', attempt: 2, preScore: 55, postScore: 78, status: 'passed', date: '25.02.2026' },
  { title: 'İlaç Yönetimi', attempt: 1, preScore: 82, postScore: 96, status: 'passed', date: '05.03.2026' },
  { title: 'Acil Durum Tahliye', attempt: 1, preScore: null, postScore: null, status: 'in_progress', date: '-' },
  { title: 'Laboratuvar Biyogüvenlik', attempt: 1, preScore: null, postScore: null, status: 'assigned', date: '-' },
];

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  locked: { label: 'Kilitli', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

export default function StaffDetailPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}><ArrowLeft className="h-5 w-5" /></Button>
          <Avatar className="h-14 w-14"><AvatarFallback className="text-lg font-bold text-white" style={{ background: 'var(--color-primary)' }}>{staff.initials}</AvatarFallback></Avatar>
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{staff.name}</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{staff.title} • {staff.department} • <span style={{ fontFamily: 'var(--font-mono)' }}>{staff.tcNo}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Atanan Eğitim" value={8} icon={GraduationCap} accentColor="var(--color-info)" />
        <StatCard title="Tamamlanan" value={6} icon={TrendingUp} accentColor="var(--color-success)" />
        <StatCard title="Başarı Oranı" value="97%" icon={TrendingUp} accentColor="var(--color-primary)" />
        <StatCard title="Ort. Puan" value="89.8" icon={TrendingUp} accentColor="var(--color-accent)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="mb-4 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Kişisel Bilgiler</h3>
          <div className="space-y-3 text-sm">
            <div><span style={{ color: 'var(--color-text-muted)' }}>E-posta:</span><p style={{ color: 'var(--color-text-primary)' }}>{staff.email}</p></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Telefon:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{staff.phone}</p></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>TC Kimlik:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{staff.tcNo}</p></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Departman:</span><p style={{ color: 'var(--color-text-primary)' }}>{staff.department}</p></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Unvan:</span><p style={{ color: 'var(--color-text-primary)' }}>{staff.title}</p></div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="mb-4 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Eğitim Geçmişi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Deneme</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ön</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {trainingHistory.map((t, i) => {
                  const st = statusMap[t.status] || statusMap.assigned;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{t.title}</td>
                      <td className="py-2.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{t.attempt}/3</td>
                      <td className="py-2.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{t.preScore !== null ? `${t.preScore}%` : '-'}</td>
                      <td className="py-2.5" style={{ fontFamily: 'var(--font-mono)', color: t.postScore !== null && t.postScore >= 70 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{t.postScore !== null ? `${t.postScore}%` : '-'}</td>
                      <td className="py-2.5"><span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: st.bg, color: st.text }}>{st.label}</span></td>
                      <td className="py-2.5" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{t.date}</td>
                      <td className="py-2.5">{t.status === 'failed' || t.status === 'locked' ? <Button variant="ghost" size="sm" className="gap-1 text-xs" style={{ color: 'var(--color-primary)' }}><RotateCcw className="h-3 w-3" /> Yeni Hak</Button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
