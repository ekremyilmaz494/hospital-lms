'use client';

import { useState } from 'react';
import { Search, Download } from 'lucide-react';
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
  createdAt: string;
  userId: string;
  entityType: string;
  entityId: string;
}

const typeColors: Record<string, { bg: string; text: string; label: string }> = {
  training: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', label: 'Eğitim' },
  assignment: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)', label: 'Atama' },
  user: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', label: 'Kullanıcı' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)', label: 'Yedek' },
};

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (entityTypeFilter) params.set('entityType', entityTypeFilter);
  const queryUrl = `/api/admin/audit-logs${params.toString() ? '?' + params.toString() : ''}`;

  const { data, isLoading, error } = useFetch<AuditLog[]>(queryUrl);

  const handleExportCSV = async () => {
    const res = await fetch('/api/admin/audit-logs?limit=1000');
    if (!res.ok) return;
    const { logs } = await res.json();
    if (!logs?.length) return;

    const headers = ['Tarih', 'Kullanıcı', 'İşlem', 'Varlık Tipi', 'Varlık ID'];
    const rows = logs.map((log: { createdAt: string; userId: string; action: string; entityType: string; entityId: string }) => [
      new Date(log.createdAt).toLocaleString('tr-TR'),
      log.userId,
      log.action,
      log.entityType,
      log.entityId,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={handleExportCSV}>
          <Download className="h-4 w-4" /> Dışa Aktar
        </Button>
      </div>

      <BlurFade delay={0.05}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="İşlem veya kullanıcı ara..."
              className="pl-9 h-10 rounded-xl"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">Tüm Tipler</option>
            <option value="training">Eğitim</option>
            <option value="staff">Personel</option>
            <option value="certificate">Sertifika</option>
            <option value="exam_attempt">Sınav</option>
            <option value="export">Dışa Aktarım</option>
          </select>
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
