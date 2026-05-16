'use client';

import { useState, useCallback } from 'react';
import { Search, Download, History, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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

// Entity tip → Klinova badge variant + label eşlemesi
const entityBadgeMap: Record<string, { variant: string; label: string }> = {
  training: { variant: 'k-badge-info', label: 'Eğitim' },
  assignment: { variant: 'k-badge-info', label: 'Atama' },
  user: { variant: 'k-badge-info', label: 'Kullanıcı' },
  staff: { variant: 'k-badge-info', label: 'Personel' },
  certificate: { variant: 'k-badge-success', label: 'Sertifika' },
  exam_attempt: { variant: 'k-badge-warning', label: 'Sınav' },
  export: { variant: 'k-badge-info', label: 'Dışa Aktarım' },
  backup: { variant: 'k-badge-muted', label: 'Yedek' },
  department: { variant: 'k-badge-info', label: 'Departman' },
  settings: { variant: 'k-badge-muted', label: 'Ayarlar' },
  notification: { variant: 'k-badge-info', label: 'Bildirim' },
  video: { variant: 'k-badge-info', label: 'Video' },
  question: { variant: 'k-badge-info', label: 'Soru' },
};

// Action türü → semantic badge variant (CREATE/UPDATE/DELETE/READ)
function getActionBadgeVariant(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('remove') || a.includes('suspend')) return 'k-badge-error';
  if (a.includes('create') || a.includes('assign') || a.includes('add')) return 'k-badge-success';
  if (a.includes('update') || a.includes('reset') || a.includes('reopen') || a.includes('restore')) return 'k-badge-warning';
  if (a.includes('export') || a.includes('read') || a.includes('view')) return 'k-badge-info';
  return 'k-badge-muted';
}

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
  'var(--k-primary)', '#e67e22', '#3498db', '#9b59b6', '#e74c3c',
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
  return entityBadgeMap[entityType]?.label ?? entityType.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerifyChain = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/admin/audit-logs/verify');
      if (res.status === 429) {
        toast('Bu islem 5 dakikada bir yapilabilir. Lutfen bekleyin.', 'warning');
        return;
      }
      if (!res.ok) {
        toast('Dogrulama sirasinda bir hata olustu', 'error');
        return;
      }
      const data = await res.json();
      if (data.verified) {
        toast(`Audit log zinciri dogrulandi — ${data.totalRecords} kayit kontrol edildi`, 'success');
      } else {
        const brokenDate = new Date(data.brokenAt.createdAt).toLocaleString('tr-TR');
        toast(`Zincir bozuldu! Ilk uyumsuz kayit: ${brokenDate}`, 'error');
      }
    } catch {
      toast('Dogrulama sirasinda bir hata olustu', 'error');
    } finally {
      setVerifying(false);
    }
  }, [toast]);

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
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</div></div>;
  }

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const filteredLogs = search
    ? logs.filter((log) => {
        const term = search.toLowerCase();
        const userName = getUserName(log.user).toLowerCase();
        const actionLabel = getActionLabel(log.action).toLowerCase();
        const entityLabel = (entityBadgeMap[log.entityType]?.label ?? '').toLowerCase();
        return userName.includes(term) || actionLabel.includes(term) || entityLabel.includes(term) || log.action.toLowerCase().includes(term);
      })
    : logs;

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">İşlem Geçmişi</span>
          </div>
          <h1 className="k-page-title">İşlem Geçmişi</h1>
          <p className="k-page-subtitle">
            <strong style={{ color: 'var(--k-text-primary)' }}>{filteredLogs.length}</strong> işlem listeleniyor — KVKK denetlenebilir, hash zinciriyle korumalı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleVerifyChain} disabled={verifying} className="k-btn k-btn-ghost">
            <ShieldCheck size={15} /> {verifying ? 'Doğrulanıyor…' : 'Zinciri Doğrula'}
          </button>
          <button onClick={handleExportCSV} className="k-btn k-btn-ghost">
            <Download size={15} /> Dışa Aktar
          </button>
        </div>
      </header>

      <BlurFade delay={0.05}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 pointer-events-none" style={{ color: 'var(--k-text-muted)' }} />
            <input
              type="text"
              placeholder="İşlem veya kullanıcı ara..."
              className="k-input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={entityTypeFilter}
            onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
            className="k-input"
            style={{ width: 'auto', minWidth: '160px' }}
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
        <div className="k-card p-5">
          {filteredLogs.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-5 -mt-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--k-bg)' }}>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>Kullanıcı</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>İşlem</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>Kaynak</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>Tür</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const entityBadge = entityBadgeMap[log.entityType] ?? { variant: 'k-badge-muted', label: log.entityType };
                      const actionVariant = getActionBadgeVariant(log.action);
                      const color = getAvatarColor(log.userId);
                      const initials = getInitials(log.user);
                      const userName = getUserName(log.user);
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--k-border)' }}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: color }}>{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-semibold text-sm" style={{ color: 'var(--k-text-primary)' }}>{userName}</span>
                                {log.user?.email && (
                                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--k-text-muted)' }}>{log.user.email}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`k-badge ${actionVariant}`}>{getActionLabel(log.action)}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-mono" style={{ color: 'var(--k-text-secondary)' }}>
                              {log.entityId ? `${log.entityId.slice(0, 8)}...` : '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`k-badge ${entityBadge.variant}`}>{entityBadge.label}</span>
                          </td>
                          <td className="px-5 py-4 text-xs font-mono" style={{ color: 'var(--k-text-muted)' }}>
                            {formatDate(log.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-1" style={{ borderTop: '1px solid var(--k-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--k-text-muted)' }}>
                    Toplam {total} kayıt
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="k-btn k-btn-ghost k-btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-medium px-2" style={{ color: 'var(--k-text-secondary)' }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      className="k-btn k-btn-ghost k-btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--k-bg)' }}>
                <History className="h-6 w-6" style={{ color: 'var(--k-text-muted)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--k-text-muted)' }}>Sistem kullanıldıkça işlem kayıtları burada görünecek.</p>
              <p className="text-xs" style={{ color: 'var(--k-text-muted)' }}>Sistem işlemleri burada görüntülenecek</p>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
