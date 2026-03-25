'use client';

import { Shield, Search, Filter, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface AuditLog {
  user: string;
  action: string;
  entity: string;
  type: string;
  time: string;
  initials: string;
  color: string;
}

const typeColors: Record<string, { bg: string; text: string; label: string }> = {
  training: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', label: 'Eğitim' },
  assignment: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)', label: 'Atama' },
  user: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', label: 'Kullanıcı' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)', label: 'Yedek' },
};

export default function AdminAuditLogsPage() {
  const { data, isLoading, error } = useFetch<AuditLog[]>('/api/admin/audit-logs');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const logs = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="İşlem Geçmişi" subtitle="Tüm sistem işlemlerini görüntüle" />
        <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          <Download className="h-4 w-4" /> Dışa Aktar
        </Button>
      </div>

      <BlurFade delay={0.05}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input placeholder="İşlem veya kullanıcı ara..." className="pl-9 h-10 rounded-xl" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
          </div>
          <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Filter className="h-4 w-4" /> Filtrele
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          {logs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kullanıcı</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kaynak</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const tc = typeColors[log.type] || typeColors.backup;
                  return (
                    <tr key={i} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: log.color }}>{log.initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">{log.user}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">{log.action}</td>
                      <td className="px-5 py-4" style={{ color: 'var(--color-text-secondary)' }}>{log.entity}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tc.bg, color: tc.text }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tc.text }} />
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{log.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
