'use client';

import { useState } from 'react';
import { Search, Download, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface AuditLogUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: unknown;
  newData: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: AuditLogUser | null;
}

interface AuditLogResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const typeColors: Record<string, { bg: string; text: string; label: string }> = {
  training: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', label: 'Eğitim' },
  assignment: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)', label: 'Atama' },
  user: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', label: 'Kullanıcı' },
  staff: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', label: 'Personel' },
  certificate: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', label: 'Sertifika' },
  exam_attempt: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', label: 'Sınav' },
  export: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)', label: 'Dışa Aktarım' },
  backup: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)', label: 'Yedek' },
  department: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', label: 'Departman' },
  settings: { bg: 'var(--color-surface-hover)', text: 'var(--color-text-muted)', label: 'Ayarlar' },
  notification: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', label: 'Bildirim' },
  video: { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', label: 'Video' },
  question: { bg: 'var(--color-accent-light)', text: 'var(--color-accent)', label: 'Soru' },
};

const actionLabels: Record<string, string> = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  'data.export': 'Dışa Aktarım',
  assign: 'Atama',
  'reset_attempt': 'Hak Sıfırlama',
  'reopen_assignment': 'Yeniden Atama',
  duplicate: 'Kopyalama',
  suspend: 'Askıya Alma',
  restore: 'Geri Yükleme',
  'training.create.full': 'Eğitim Oluşturma',
  'training.update': 'Eğitim Güncelleme',
  'training.delete': 'Eğitim Silme',
  'department.create': 'Departman Oluşturma',
  'department.update': 'Departman Güncelleme',
  'department.delete': 'Departman Silme',
  'department.add_member': 'Departmana Üye Ekleme',
  'department.remove_member': 'Departmandan Üye Çıkarma',
  'bulk_assign': 'Toplu Atama',
  'certificate.create': 'Sertifika Oluşturma',
  'settings.update': 'Ayar Güncelleme',
  'send_reminder': 'Hatırlatma Gönderme',
};

const avatarColors = [
  '#0d9668', '#e67e22', '#3498db', '#9b59b6', '#e74c3c',
  '#1abc9c', '#f39c12', '#2980b9', '#8e44ad', '#c0392b',
];

function getAvatarColor(userId: string | null): string {
  if (!userId) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(user: AuditLogUser | null): string {
  if (!user) return 'S';
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'S';
}

function getUserName(user: AuditLogUser | null): string {
  if (!user) return 'Sistem';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Sistem';
}

function getActionLabel(action: string): string {
  if (actionLabels[action]) return actionLabels[action];
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getEntityLabel(entityType: string): string {
  return typeColors[entityType]?.label ?? entityType.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (entityTypeFilter) params.set('entityType', entityTypeFilter);
  const queryUrl = `/api/admin/audit-logs?${params.toString()}`;

  const { data, isLoading, error } = useFetch<AuditLogResponse>(queryUrl);

  const handleExportCSV = async () => {
    // max 500 kayıt — ?limit=1000 performans sorunu yaratıyordu
    const exportParams = new URLSearchParams();
    exportParams.set('limit', '500');
    exportParams.set('page', '1');
    if (entityTypeFilter) exportParams.set('entityType', entityTypeFilter);
    const res = await fetch(`/api/admin/audit-logs?${exportParams.toString()}`);
    if (!res.ok) return;
    const { logs } = await res.json();
    if (!logs?.length) return;

    const headers = ['Tarih', 'Kullanıcı', 'E-posta', 'İşlem', 'Varlık Tipi', 'Varlık ID'];
    const rows = logs.map((log: AuditLogItem) => [
      new Date(log.createdAt).toLocaleString('tr-TR'),
      getUserName(log.user),
      log.user?.email ?? '-',
      getActionLabel(log.action),
      getEntityLabel(log.entityType),
      log.entityId ?? '-',
    ]);
    const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${c}"`).join(';')).join('\n');
    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvBytes = encoder.encode(csv);
    const blob = new Blob([bom, csvBytes], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `islem-gecmisi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;
  }

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const filteredLogs = search
    ? logs.filter((log) => {
        const term = search.toLowerCase();
        const userName = getUserName(log.user).toLowerCase();
        const actionLabel = getActionLabel(log.action).toLowerCase();
        const entityLabel = (typeColors[log.entityType]?.label ?? '').toLowerCase();
        return userName.includes(term) || actionLabel.includes(term) || entityLabel.includes(term) || log.action.toLowerCase().includes(term);
      })
    : logs;

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
            onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">Tüm Tipler</option>
            <option value="training">Eğitim</option>
            <option value="user">Kullanıcı</option>
            <option value="staff">Personel</option>
            <option value="certificate">Sertifika</option>
            <option value="exam_attempt">Sınav</option>
            <option value="export">Dışa Aktarım</option>
            <option value="department">Departman</option>
            <option value="backup">Yedek</option>
          </select>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          {filteredLogs.length > 0 ? (
            <>
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
                  {filteredLogs.map((log) => {
                    const tc = typeColors[log.entityType] ?? typeColors.backup;
                    const color = getAvatarColor(log.userId);
                    const initials = getInitials(log.user);
                    const userName = getUserName(log.user);
                    return (
                      <tr key={log.id} className="transition-colors duration-100 hover:bg-(--color-surface-hover)" style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: color }}>{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{userName}</span>
                              {log.user?.email && (
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{log.user.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{getActionLabel(log.action)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {log.entityId ? `${log.entityId.slice(0, 8)}...` : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tc.bg, color: tc.text }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tc.text }} />
                            {tc.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {formatDate(log.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Toplam {total} kayıt
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                      style={{ borderColor: 'var(--color-border)' }}
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium px-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                      style={{ borderColor: 'var(--color-border)' }}
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-bg)' }}>
                <History className="h-6 w-6" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Henüz işlem kaydı yok</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sistem işlemleri burada görüntülenecek</p>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
