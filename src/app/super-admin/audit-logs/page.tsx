'use client';

import { Shield, Search, Filter, User, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';

const mockLogs = [
  { id: '1', user: 'Süper Admin', action: 'Hastane oluşturuldu', entity: 'Devakent Hastanesi', entityType: 'organization', ip: '192.168.1.10', time: '24.03.2026 14:32', initials: 'SA', color: 'var(--color-primary)' },
  { id: '2', user: 'Dr. Ahmet Yılmaz', action: 'Eğitim oluşturuldu', entity: 'Enfeksiyon Kontrol Eğitimi', entityType: 'training', ip: '192.168.1.25', time: '24.03.2026 12:15', initials: 'AY', color: 'var(--color-accent)' },
  { id: '3', user: 'Süper Admin', action: 'Abonelik güncellendi', entity: 'Anadolu Sağlık → Profesyonel', entityType: 'subscription', ip: '192.168.1.10', time: '24.03.2026 10:45', initials: 'SA', color: 'var(--color-primary)' },
  { id: '4', user: 'Fatma Demir', action: '15 personele eğitim atandı', entity: 'İş Güvenliği Eğitimi', entityType: 'assignment', ip: '192.168.1.30', time: '23.03.2026 16:20', initials: 'FD', color: 'var(--color-info)' },
  { id: '5', user: 'Süper Admin', action: 'Hastane askıya alındı', entity: 'Çukurova Devlet H.', entityType: 'organization', ip: '192.168.1.10', time: '23.03.2026 11:30', initials: 'SA', color: 'var(--color-error)' },
  { id: '6', user: 'Dr. Mehmet Kara', action: 'Personel eklendi', entity: 'Ali Veli', entityType: 'user', ip: '192.168.1.42', time: '22.03.2026 15:10', initials: 'MK', color: 'var(--color-success)' },
  { id: '7', user: 'Sistem', action: 'Otomatik yedek alındı', entity: 'backup_20260322.sql.gz', entityType: 'backup', ip: '-', time: '22.03.2026 03:00', initials: 'SY', color: 'var(--color-text-muted)' },
  { id: '8', user: 'Süper Admin', action: 'Plan fiyatı güncellendi', entity: 'Profesyonel → ₺7.999/ay', entityType: 'subscription', ip: '192.168.1.10', time: '21.03.2026 09:45', initials: 'SA', color: 'var(--color-primary)' },
];

const typeColors: Record<string, { bg: string; text: string }> = {
  organization: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
  training: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)' },
  subscription: { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  assignment: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  user: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)' },
};

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Audit Log" subtitle="Tüm sistem işlemlerini görüntüle" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <Input placeholder="İşlem veya kullanıcı ara..." className="pl-9" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
        </div>
        <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <Filter className="h-4 w-4" /> Filtrele
        </Button>
      </div>

      {/* Log Table */}
      <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kullanıcı</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kaynak</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>IP</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {mockLogs.map((log) => {
                const typeStyle = typeColors[log.entityType] || typeColors.backup;
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: log.color }}>
                            {log.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{log.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>{log.action}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--color-text-secondary)' }}>{log.entity}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: typeStyle.bg, color: typeStyle.text }}>
                        {log.entityType}
                      </span>
                    </td>
                    <td className="px-5 py-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{log.ip}</td>
                    <td className="px-5 py-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{log.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
