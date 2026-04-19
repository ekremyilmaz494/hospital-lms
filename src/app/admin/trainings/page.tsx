'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { GraduationCap, Plus, MoreHorizontal, Eye, Edit, Trash2, Calendar, Users, X, Layers } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { BulkAssignModal } from '@/components/shared/bulk-assign-modal';
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
import { Button } from '@/components/ui/button';

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

const publishStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  published: { label: 'Yayında', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  draft: { label: 'Taslak', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  archived: { label: 'Arşivlendi', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
};


const categoryColors: Record<string, string> = {
  'Enfeksiyon': 'var(--color-error)',
  'İş Güvenliği': 'var(--color-accent)',
  'Hasta Hakları': 'var(--color-info)',
  'Radyoloji': 'var(--color-primary)',
  'Laboratuvar': 'var(--color-success)',
  'Eczane': 'var(--color-warning)',
};

const allCategories = Object.keys(categoryColors);

export default function TrainingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{ trainings: Training[]; total: number }>('/api/admin/trainings');
  const { data: staffData } = useFetch<{ staff: { id: string; name: string; department: string }[] }>('/api/admin/staff?limit=500');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Training | null>(null);
  const [forceTarget, setForceTarget] = useState<{ training: Training; activeAttemptCount: number } | null>(null);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const allTrainings = data?.trainings ?? [];

  const filteredTrainings = allTrainings.filter((t) => {
    if (statusFilter && t.publishStatus !== statusFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    return true;
  });

  const activeFilters = [statusFilter, categoryFilter].filter(Boolean).length;

  const handlePublishStatus = async (training: Training, status: 'draft' | 'published' | 'archived') => {
    try {
      const res = await fetch(`/api/admin/trainings/${training.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishStatus: status }),
      });
      if (!res.ok) throw new Error();
      const label = publishStatusConfig[status]?.label ?? status;
      toast(`"${training.title}" ${label} olarak güncellendi`, 'success');
      refetch();
    } catch {
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
            style={{ background: `${categoryColors[row.original.category] || 'var(--color-primary)'}20` }}
          >
            <GraduationCap className="h-5 w-5" style={{ color: categoryColors[row.original.category] || 'var(--color-primary)' }} />
          </div>
          <div className="min-w-0">
            <p
              className="font-semibold truncate"
              style={{ color: 'var(--color-text-primary)', transition: 'color var(--transition-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            >
              {row.getValue('title')}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `${categoryColors[row.original.category] || 'var(--color-primary)'}15`, color: categoryColors[row.original.category] || 'var(--color-primary)' }}
              >
                {row.original.category}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
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
          <Users className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="font-medium" style={{ fontFamily: 'var(--font-mono)' }}>{row.getValue('assignedCount')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'completedCount',
      header: 'Tamamlayan',
      size: 100,
      cell: ({ row }) => (
        <span className="font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
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
        const color = rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-20 rounded-full" style={{ background: 'var(--color-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${rate}%`, background: color, transition: 'width var(--transition-base)' }} />
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
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: cfg.bg, color: cfg.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.text }} />
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
          <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date(row.getValue('endDate') as string).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
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
                <Eye className="h-4 w-4" style={{ color: 'var(--color-success)' }} /> Yayınla
              </DropdownMenuItem>
            )}
            {row.original.publishStatus !== 'draft' && (
              <DropdownMenuItem className="gap-2" onClick={() => handlePublishStatus(row.original, 'draft')}>
                <Edit className="h-4 w-4" style={{ color: 'var(--color-warning)' }} /> Taslağa Al
              </DropdownMenuItem>
            )}
            {row.original.publishStatus !== 'archived' && (
              <DropdownMenuItem className="gap-2" onClick={() => handlePublishStatus(row.original, 'archived')}>
                <X className="h-4 w-4" style={{ color: 'var(--color-info)' }} /> Arşivle
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
    <div className="space-y-4">
      <PageHeader
        title="Eğitim Yönetimi"
        subtitle={`${filteredTrainings.length} eğitim listeleniyor`}
        action={{ label: 'Yeni Eğitim', icon: Plus, onClick: () => router.push('/admin/trainings/new') }}
        secondaryAction={{ label: 'Toplu Eğitim Ata', icon: Layers, onClick: () => setShowBulkAssign(true) }}
      />
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
        {[
          { label: 'Toplam', value: allTrainings.length, color: 'var(--color-primary)' },
          { label: 'Yayında', value: allTrainings.filter(t => t.publishStatus === 'published').length, color: 'var(--color-success)' },
          { label: 'Taslak', value: allTrainings.filter(t => t.publishStatus === 'draft').length, color: 'var(--color-warning)' },
          { label: 'Arşivlendi', value: allTrainings.filter(t => t.publishStatus === 'archived').length, color: 'var(--color-info)' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</span>
            <span className="ml-auto text-lg font-bold font-heading" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Filtreler:</span>

        <div className="flex gap-1.5">
          {Object.entries(publishStatusConfig).map(([key, cfg]) => {
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(isActive ? null : key)}
                aria-label={`Filtrele: ${cfg.label}`}
                aria-pressed={isActive}
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{
                  background: isActive ? cfg.bg : 'transparent',
                  color: isActive ? cfg.text : 'var(--color-text-muted)',
                  border: `1.5px solid ${isActive ? cfg.text : 'var(--color-border)'}`,
                  transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>


        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter(null); setCategoryFilter(null); }}
            aria-label="Filtreleri temizle"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
          >
            <X className="h-3 w-3" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
      >
        {filteredTrainings.length > 0 ? (
          <DataTable columns={columns} data={filteredTrainings} searchKey="title" searchPlaceholder="Eğitim adı veya kategori ara..." />
        ) : (
          <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz eğitim oluşturulmadı. İlk eğitimi ekleyerek başlayın.</div>
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
            <Button variant="outline" disabled={!!deletingId} onClick={() => setDeleteTarget(null)}>Vazgeç</Button>
            <Button
              disabled={!!deletingId}
              style={{ background: 'var(--color-error)', color: 'white' }}
              onClick={() => deleteTarget && confirmDelete(deleteTarget, false)}
            >
              {deletingId ? 'Siliniyor...' : 'Evet, sil'}
            </Button>
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
            <Button variant="outline" disabled={!!deletingId} onClick={() => setForceTarget(null)}>Vazgeç</Button>
            <Button
              disabled={!!deletingId}
              style={{ background: 'var(--color-error)', color: 'white' }}
              onClick={() => forceTarget && confirmDelete(forceTarget.training, true)}
            >
              {deletingId ? 'Siliniyor...' : 'Yine de sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
