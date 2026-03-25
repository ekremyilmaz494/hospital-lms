'use client';
import { Shield, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';

const logs = [
  { user: 'Dr. Ahmet Yılmaz', action: 'Eğitim oluşturuldu', entity: 'Enfeksiyon Kontrol', type: 'training', time: '24.03.2026 14:32', initials: 'AY', color: 'var(--color-primary)' },
  { user: 'Fatma Demir', action: '15 personele eğitim atandı', entity: 'İş Güvenliği', type: 'assignment', time: '24.03.2026 12:15', initials: 'FD', color: 'var(--color-accent)' },
  { user: 'Dr. Ahmet Yılmaz', action: 'Personel eklendi', entity: 'Hasan Kılıç', type: 'user', time: '23.03.2026 16:20', initials: 'AY', color: 'var(--color-primary)' },
  { user: 'Sistem', action: 'Otomatik yedek alındı', entity: 'backup_20260323.sql.gz', type: 'backup', time: '23.03.2026 03:00', initials: 'SY', color: 'var(--color-text-muted)' },
  { user: 'Dr. Ahmet Yılmaz', action: 'Yeni deneme hakkı verildi', entity: 'Ali Veli → İş Güvenliği', type: 'assignment', time: '22.03.2026 11:30', initials: 'AY', color: 'var(--color-primary)' },
];

const typeColors: Record<string, { bg: string; text: string }> = {
  training: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
  assignment: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)' },
  user: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)' },
};

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="İşlem Geçmişi" subtitle="Tüm sistem işlemlerini görüntüle" />
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /><Input placeholder="İşlem veya kullanıcı ara..." className="pl-9" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} /></div>
        <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Filter className="h-4 w-4" /> Filtrele</Button>
      </div>
      <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kullanıcı</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kaynak</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
          </tr></thead>
          <tbody>{logs.map((log, i) => {
            const tc = typeColors[log.type] || typeColors.backup;
            return (<tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: log.color }}>{log.initials}</AvatarFallback></Avatar><span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{log.user}</span></div></td>
              <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>{log.action}</td>
              <td className="px-5 py-3" style={{ color: 'var(--color-text-secondary)' }}>{log.entity}</td>
              <td className="px-5 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tc.bg, color: tc.text }}>{log.type}</span></td>
              <td className="px-5 py-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{log.time}</td>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
