'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { GraduationCap, Plus, MoreHorizontal, Eye, Edit, Trash2, Calendar, Users, X, Layers, ChevronRight, BookOpen, CheckCircle2, FileEdit, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/data-table';
import { BulkAssignModal } from '@/components/shared/bulk-assign-modal';
import { KStatCard } from '@/components/admin/k-stat-card';
import Link from 'next/link';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Training {
  id: string;
  title: string;
  category: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  passingScore: number;
  status: string;
  publishStatus: string;
  startDate: string;
  endDate: string;
  createdBy: string;
}

const publishStatusConfig: Record<string, { label: string; badgeClass: string; color: string }> = {
  published: { label: 'Yayında', badgeClass: 'k-badge k-badge-success', color: 'var(--k-success)' },
  draft: { label: 'Taslak', badgeClass: 'k-badge k-badge-warning', color: 'var(--k-warning)' },
  archived: { label: 'Arşivlendi', badgeClass: 'k-badge k-badge-info', color: 'var(--k-info)' },
};


const categoryColors: Record<string, string> = {
  'Enfeksiyon': 'var(--k-error)',
  'İş Güvenliği': 'var(--k-warning)',
  'Hasta Hakları': 'var(--k-info)',
  'Radyoloji': 'var(--k-primary)',
  'Laboratuvar': 'var(--k-success)',
  'Eczane': 'var(--k-warning)',
};

const allCategories = Object.keys(categoryColors);

export default function TrainingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{ trainings: Training[]; total: number }>('/api/admin/trainings');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  // Lazy: sadece BulkAssignModal açılınca 500 personeli çek (TTFB'yi düşürür)
  const { data: staffData } = useFetch<{ staff: { id: string; name: string; department: string }[] }>(
    showBulkAssign ? '/api/admin/staff?limit=500' : null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Training | null>(null);
  const [forceTarget, setForceTarget] = useState<{ training: Training; activeAttemptCount: number } | null>(null);
  // Optimistic publish-status override: PATCH dönüşünü beklemeden UI hemen güncellensin.
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({});

  // Sunucudan gelen veri override'la eşleştiğinde override'ı temizle (state birikmesin).
  useEffect(() => {
    if (!data?.trainings) return;
    setOptimisticStatus((prev) => {
      const prevKeys = Object.keys(prev);
      if (prevKeys.length === 0) return prev;
      const next: Record<string, string> = {};
      for (const t of data.trainings) {
        if (prev[t.id] && prev[t.id] !== t.publishStatus) next[t.id] = prev[t.id];
      }
      const nextKeys = Object.keys(next);
      if (nextKeys.length === prevKeys.length && nextKeys.every((k) => next[k] === prev[k])) {
        return prev;
      }
      return next;
    });
  }, [data]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--k-error)'}}>{error}</div></div>;
  }

  const allTrainings = (data?.trainings ?? []).map((t) =>
    optimisticStatus[t.id] ? { ...t, publishStatus: optimisticStatus[t.id] } : t,
  );

  const filteredTrainings = allTrainings.filter((t) => {
    if (statusFilter && t.publishStatus !== statusFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    return true;
  });

  const activeFilters = [statusFilter, categoryFilter].filter(Boolean).length;

  const handlePublishStatus = async (training: Training, status: 'draft' | 'published' | 'archived') => {
    // 1) Anında UI güncelle (optimistic)
    setOptimisticStatus((prev) => ({ ...prev, [training.id]: status }));
    const label = publishStatusConfig[status]?.label ?? status;
    toast(`"${training.title}" ${label} olarak güncellendi`, 'success');

    // 2) Sunucuya yaz, hata olursa override'ı geri al
    try {
      const res = await fetch(`/api/admin/trainings/${training.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishStatus: status }),
      });
      if (!res.ok) throw new Error();
      // refetch await edilmiyor — arka planda taze veriyle reconcile, override sonra temizlenir
      refetch();
    } catch {
      setOptimisticStatus((prev) => {
        const rest = { ...prev };
        delete rest[training.id];
        return rest;
      });
      toast('Durum güncellenemedi', 'error');
    }
  };

  const confirmDelete = async (training: Training, force = false) => {
    setDeletingId(training.id);
    try {
      const url = force ? `/api/admin/trainings/${training.id}?force=true` : `/api/admin/trainings/${training.id}`;
      const res = await fetch(url, { method: 'DELETE' });

      if (!force && res.status === 409) {
        const data = await res.json().catch(() => null) as { requiresConfirmation?: boolean; activeAttemptCount?: number } | null;
        if (data?.requiresConfirmation) {
          setDeleteTarget(null);
          setForceTarget({ training, activeAttemptCount: data.activeAttemptCount ?? 0 });
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string; message?: string } | null;
        throw new Error(data?.error || data?.message || `Silme başarısız (HTTP ${res.status})`);
      }
      toast(`"${training.title}" silindi`, 'success');
      setDeleteTarget(null);
      setForceTarget(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Eğitim silinirken hata oluştu', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDef<Training>[] = [
    {
      accessorKey: 'title',
      header: 'Eğitim Adı',
      size: 280,
      cell: ({ row }) => (
        <Link href={`/admin/trainings/${row.original.id}`} className="flex items-center gap-3 group min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${categoryColors[row.original.category] || 'var(--k-primary)'} 14%, transparent)` }}
          >
            <GraduationCap className="h-5 w-5" style={{ color: categoryColors[row.original.category] || 'var(--k-primary)' }} />
          </div>
          <div className="min-w-0">
            <p
              className="font-semibold truncate"
              style={{ color: 'var(--k-text-primary)', transition: 'color 160ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--k-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--k-text-primary)'; }}
            >
              {row.getValue('title')}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `color-mix(in srgb, ${categoryColors[row.original.category] || 'var(--k-primary)'} 12%, transparent)`, color: categoryColors[row.original.category] || 'var(--k-primary)' }}
              >
                {row.original.category}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                {row.original.createdBy}
              </span>
            </div>
          </div>
        </Link>
      ),
    },
    {
      accessorKey: 'assignedCount',
      header: 'Atanan',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" style={{ color: 'var(--k-text-muted)' }} />
          <span className="font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--k-text-primary)' }}>{row.getValue('assignedCount')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'completedCount',
      header: 'Tamamlayan',
      size: 100,
      cell: ({ row }) => (
        <span className="font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--k-primary)' }}>
          {row.original.completedCount}/{row.original.assignedCount}
        </span>
      ),
    },
    {
      accessorKey: 'completionRate',
      header: 'Tamamlanma',
      size: 140,
      cell: ({ row }) => {
        const rate = row.getValue('completionRate') as number;
        const color = rate >= 80 ? 'var(--k-success)' : rate >= 50 ? 'var(--k-warning)' : 'var(--k-error)';
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-20 rounded-full" style={{ background: 'var(--k-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${rate}%`, background: color, transition: 'width 240ms ease' }} />
            </div>
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color }}>{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'publishStatus',
      header: 'Durum',
      size: 100,
      cell: ({ row }) => {
        const ps = (row.original.publishStatus ?? 'published') as string;
        const cfg = publishStatusConfig[ps] || publishStatusConfig.published;
        return (
          <span className={cfg.badgeClass}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'endDate',
      header: 'Bitiş',
      size: 110,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--k-text-muted)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--k-text-secondary)' }}>{new Date(row.getValue('endDate') as string).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent hover:text-accent-foreground" aria-label="Eğitim işlemleri">
              <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/trainings/${row.original.id}`)}>
              <Eye className="h-4 w-4" /> Detay Görüntüle
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/trainings/${row.original.id}/edit`)}>
              <Edit className="h-4 w-4" /> Düzenle
            </DropdownMenuItem>
            {row.original.publishStatus !== 'published' && (
              <DropdownMenuItem className="gap-2" onClick={() => handlePublishStatus(row.original, 'published')}>
                <Eye className="h-4 w-4" style={{ color: 'var(--k-success)' }} /> Yayınla
              </DropdownMenuItem>
            )}
            {row.original.publishStatus !== 'draft' && (
              <DropdownMenuItem className="gap-2" onClick={() => handlePublishStatus(row.original, 'draft')}>
                <Edit className="h-4 w-4" style={{ color: 'var(--k-warning)' }} /> Taslağa Al
              </DropdownMenuItem>
            )}
            {row.original.publishStatus !== 'archived' && (
              <DropdownMenuItem className="gap-2" onClick={() => handlePublishStatus(row.original, 'archived')}>
                <X className="h-4 w-4" style={{ color: 'var(--k-info)' }} /> Arşivle
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 text-red-500" disabled={deletingId === row.original.id} onClick={() => setDeleteTarget(row.original)}>
              <Trash2 className="h-4 w-4" /> {deletingId === row.original.id ? 'Siliniyor...' : 'Sil'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Eğitimler</span>
          </div>
          <h1 className="k-page-title">Eğitim Yönetimi</h1>
          <p className="k-page-subtitle">
            <strong style={{ color: 'var(--k-text-primary)' }}>{filteredTrainings.length}</strong> eğitim listeleniyor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBulkAssign(true)} className="k-btn k-btn-ghost">
            <Layers size={15} /> Toplu Eğitim Ata
          </button>
          <button onClick={() => router.push('/admin/trainings/new')} className="k-btn k-btn-primary">
            <Plus size={15} /> Yeni Eğitim
          </button>
        </div>
      </header>
      {showBulkAssign && (
        <BulkAssignModal
          trainings={allTrainings.map(t => ({ id: t.id, title: t.title, category: t.category }))}
          staff={(staffData?.staff ?? []).map(s => ({ id: s.id, name: s.name, department: s.department ?? '' }))}
          onClose={() => setShowBulkAssign(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KStatCard
          title="Toplam"
          value={allTrainings.length}
          icon={BookOpen}
          accentColor="var(--k-primary)"
        />
        <KStatCard
          title="Yayında"
          value={allTrainings.filter(t => t.publishStatus === 'published').length}
          icon={CheckCircle2}
          accentColor="var(--k-success)"
        />
        <KStatCard
          title="Taslak"
          value={allTrainings.filter(t => t.publishStatus === 'draft').length}
          icon={FileEdit}
          accentColor="var(--k-warning)"
        />
        <KStatCard
          title="Arşivlendi"
          value={allTrainings.filter(t => t.publishStatus === 'archived').length}
          icon={Archive}
          accentColor="var(--k-info)"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>Filtreler:</span>

        <div className="k-tabs" role="tablist" aria-label="Yayın durumu filtresi">
          <button
            type="button"
            className="k-tab"
            data-active={statusFilter === null}
            onClick={() => setStatusFilter(null)}
            aria-pressed={statusFilter === null}
          >
            Tümü
          </button>
          {Object.entries(publishStatusConfig).map(([key, cfg]) => {
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                className="k-tab"
                data-active={isActive}
                onClick={() => setStatusFilter(isActive ? null : key)}
                aria-label={`Filtrele: ${cfg.label}`}
                aria-pressed={isActive}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        <label className="k-input" style={{ minWidth: 200 }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--k-text-muted)' }}>Kategori</span>
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            aria-label="Kategori filtresi"
          >
            <option value="">Tümü</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter(null); setCategoryFilter(null); }}
            aria-label="Filtreleri temizle"
            className="k-btn k-btn-ghost k-btn-sm"
            style={{ color: 'var(--k-error)' }}
          >
            <X size={13} /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      <div className="k-card p-5">
        {filteredTrainings.length > 0 ? (
          <DataTable columns={columns} data={filteredTrainings} searchKey="title" searchPlaceholder="Eğitim adı veya kategori ara..." />
        ) : (
          <div className="text-sm text-center py-8" style={{ color: 'var(--k-text-muted)' }}>Henüz eğitim oluşturulmadı. İlk eğitimi ekleyerek başlayın.</div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eğitimi sil</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.title}&quot; eğitimini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="k-btn k-btn-ghost" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Vazgeç</button>
            <button
              type="button"
              className="k-btn k-btn-primary"
              disabled={!!deletingId}
              style={{ background: 'var(--k-error)', borderColor: 'var(--k-error)' }}
              onClick={() => deleteTarget && confirmDelete(deleteTarget, false)}
            >
              {deletingId ? 'Siliniyor...' : 'Evet, sil'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!forceTarget} onOpenChange={(open) => { if (!open && !deletingId) setForceTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devam eden sınavlar var</DialogTitle>
            <DialogDescription>
              {forceTarget?.activeAttemptCount} personelin bu eğitimde devam eden sınavı bulunuyor. Yine de silmek (arşivlemek) istiyor musunuz? Devam eden sınavlar iptal edilecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="k-btn k-btn-ghost" disabled={!!deletingId} onClick={() => setForceTarget(null)}>Vazgeç</button>
            <button
              type="button"
              className="k-btn k-btn-primary"
              disabled={!!deletingId}
              style={{ background: 'var(--k-error)', borderColor: 'var(--k-error)' }}
              onClick={() => forceTarget && confirmDelete(forceTarget.training, true)}
            >
              {deletingId ? 'Siliniyor...' : 'Yine de sil'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
