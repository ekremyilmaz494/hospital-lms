'use client';

import { useMemo, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityType: string;
  ip: string;
  time: string;
  initials: string;
  color: string;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  organization: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
  training: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)' },
  subscription: { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  assignment: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  user: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)' },
};

const ENTITY_TYPES = ['organization', 'training', 'subscription', 'assignment', 'user', 'backup'];
const ACTION_TYPES = ['create', 'update', 'delete', 'login', 'logout'];

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [entityType, action]);

  const { data, isLoading, error } = useFetch<{ logs: AuditLog[]; total: number }>(
    `/api/super-admin/audit-logs${queryString}`,
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const logList = data?.logs ?? [];
  const filteredLogs = search.trim()
    ? logList.filter(l => {
        const term = search.toLowerCase();
        return l.user.toLowerCase().includes(term) ||
               l.action.toLowerCase().includes(term) ||
               (l.entity ?? '').toLowerCase().includes(term);
      })
    : logList;

  const hasActiveFilters = entityType || action;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Audit Log" subtitle="Tüm sistem işlemlerini görüntüle" />

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="İşlem veya kullanıcı ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(v => !v)}
            className="gap-2"
            style={{
              borderColor: hasActiveFilters ? 'var(--color-primary)' : 'var(--color-border)',
              color: hasActiveFilters ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <Filter className="h-4 w-4" /> Filtrele
            {hasActiveFilters && (
              <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                {[entityType, action].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <button
              onClick={() => { setEntityType(''); setAction(''); }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="h-3 w-3" /> Temizle
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Tümü</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Tümü</option>
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Log Table */}
      <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
        ) : (
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
                {filteredLogs.map((log) => {
                  const typeStyle = typeColors[log.entityType] || typeColors.backup;
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: log.color ?? 'var(--color-primary)' }}>
                              {log.initials ?? ''}
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
        )}
      </div>
    </div>
  );
}
