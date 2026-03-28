'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { GraduationCap, Plus, MoreHorizontal, Eye, Edit, Trash2, Calendar, Users, X, Layers, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { BulkAssignModal } from '@/components/shared/bulk-assign-modal';
import Link from 'next/link';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Training {
  id: string;
  title: string;
  category: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  passingScore: number;
  status: string;
  startDate: string;
  endDate: string;
  createdBy: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  'Aktif': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Taslak': { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  'Tamamlandı': { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  'Süresi Doldu': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
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
const allStatuses = Object.keys(statusColors);

export default function TrainingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{ trainings: Training[]; total: number }>('/api/admin/trainings');
  const { data: staffData } = useFetch<{ staff: { id: string; name: string; department: string }[] }>('/api/admin/staff');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const allTrainings = data?.trainings ?? [];

  const filteredTrainings = allTrainings.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    return true;
  });

  const activeFilters = [statusFilter, categoryFilter].filter(Boolean).length;

  const handleDuplicate = async (training: Training) => {
    setDuplicatingId(training.id);
    try {
      const res = await fetch(`/api/admin/trainings/${training.id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Kopyalama başarısız');
      const data = await res.json();
      toast(`"${training.title}" kopyalandı. Taslak olarak kaydedildi.`, 'success');
      router.push(`/admin/trainings/${data.id}/edit`);
    } catch {
      toast('Eğitim kopyalanırken hata oluştu', 'error');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (training: Training) => {
    if (window.confirm(`"${training.title}" eğitimini silmek istediğinize emin misiniz?`)) {
      setDeletingId(training.id);
      try {
        const res = await fetch(`/api/admin/trainings/${training.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Silme başarısız');
        refetch();
      } catch {
        toast('Eğitim silinirken hata oluştu', 'error');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const columns: ColumnDef<Training>[] = [
    {
      accessorKey: 'title',
      header: 'Eğitim Adı',
      cell: ({ row }) => (
        <Link href={`/admin/trainings/${row.original.id}`} className="flex items-center gap-3 group">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${categoryColors[row.original.category] || 'var(--color-primary)'}20` }}
          >
            <GraduationCap className="h-5 w-5" style={{ color: categoryColors[row.original.category] || 'var(--color-primary)' }} />
          </div>
          <div>
            <p
              className="font-semibold"
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
      cell: ({ row }) => (
        <span className="font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
          {row.original.completedCount}/{row.original.assignedCount}
        </span>
      ),
    },
    {
      accessorKey: 'completionRate',
      header: 'Tamamlanma',
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
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const colors = statusColors[status] || { bg: 'var(--color-info-bg)', text: 'var(--color-info)' };
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.text }} />
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'endDate',
      header: 'Bitiş',
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
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent hover:text-accent-foreground">
              <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/trainings/${row.original.id}`)}>
              <Eye className="h-4 w-4" /> Detay Görüntüle
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/trainings/${row.original.id}/edit`)}>
              <Edit className="h-4 w-4" /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" disabled={duplicatingId === row.original.id} onClick={() => handleDuplicate(row.original)}>
              <Copy className="h-4 w-4" /> {duplicatingId === row.original.id ? 'Kopyalanıyor...' : 'Kopyala'}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-red-500" disabled={deletingId === row.original.id} onClick={() => handleDelete(row.original)}>
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
          { label: 'Aktif', value: allTrainings.filter(t => t.status === 'Aktif').length, color: 'var(--color-success)' },
          { label: 'Taslak', value: allTrainings.filter(t => t.status === 'Taslak').length, color: 'var(--color-warning)' },
          { label: 'Tamamlandı', value: allTrainings.filter(t => t.status === 'Tamamlandı').length, color: 'var(--color-info)' },
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
          {allStatuses.map((status) => {
            const isActive = statusFilter === status;
            const colors = statusColors[status];
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isActive ? null : status)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{
                  background: isActive ? colors.bg : 'transparent',
                  color: isActive ? colors.text : 'var(--color-text-muted)',
                  border: `1.5px solid ${isActive ? colors.text : 'var(--color-border)'}`,
                  transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
                }}
              >
                {status}
              </button>
            );
          })}
        </div>


        {activeFilters > 0 && (
          <button
            onClick={() => { setStatusFilter(null); setCategoryFilter(null); }}
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
          <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
        )}
      </div>
    </div>
  );
}
