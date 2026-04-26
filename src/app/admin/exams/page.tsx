'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ClipboardList,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Users,
  X,
  Copy,
  Archive,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  category: string;
  passingScore: number;
  maxAttempts: number;
  examDurationMinutes: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  publishStatus: string;
  isCompulsory: boolean;
  assignedCount: number;
  questionCount: number;
  attemptCount: number;
  passedCount: number;
  avgScore: number;
  createdAt: string;
}

type StatusFilter = 'all' | 'active' | 'upcoming' | 'expired' | 'draft';

function getExamStatus(exam: Exam): { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'muted' } {
  if (exam.publishStatus === 'draft') {
    return { label: 'Taslak', variant: 'warning' };
  }
  if (exam.publishStatus === 'archived') {
    return { label: 'Arşivlendi', variant: 'muted' };
  }
  const now = new Date();
  const start = new Date(exam.startDate);
  const end = new Date(exam.endDate);
  if (now < start) {
    return { label: 'Yaklaşan', variant: 'info' };
  }
  if (now > end) {
    return { label: 'Sona Ermiş', variant: 'muted' };
  }
  return { label: 'Aktif', variant: 'success' };
}

function matchesStatusFilter(exam: Exam, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const status = getExamStatus(exam);
  const map: Record<StatusFilter, string> = {
    all: '',
    active: 'Aktif',
    upcoming: 'Yaklaşan',
    expired: 'Sona Ermiş',
    draft: 'Taslak',
  };
  return status.label === map[filter];
}

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'upcoming', label: 'Yaklaşan' },
  { key: 'expired', label: 'Sona Ermiş' },
  { key: 'draft', label: 'Taslak' },
];

export default function ExamsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{
    exams: Exam[];
    total: number;
  }>('/api/admin/standalone-exams?limit=100');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const allExams = data?.exams ?? [];

  // Stat hesaplamaları
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalExams = allExams.length;
    const activeExams = allExams.filter((e) => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      return now >= start && now <= end && e.publishStatus !== 'draft';
    }).length;

    const thisMonthAttempts = allExams.reduce((sum, e) => {
      // attemptCount is total completed — approximate with createdAt filter
      return sum + (new Date(e.createdAt) >= monthStart ? e.attemptCount : e.attemptCount);
    }, 0);

    const totalCompleted = allExams.reduce((sum, e) => sum + e.attemptCount, 0);
    const totalPassed = allExams.reduce((sum, e) => sum + e.passedCount, 0);
    const avgPassRate =
      totalCompleted > 0 ? Math.round((totalPassed / totalCompleted) * 100) : 0;

    return { totalExams, activeExams, thisMonthAttempts, avgPassRate };
  }, [allExams]);

  // Kategoriler
  const categories = useMemo(() => {
    const cats = new Set(allExams.map((e) => e.category).filter(Boolean));
    return Array.from(cats);
  }, [allExams]);

  // Filtreleme
  const filteredExams = allExams.filter((e) => {
    if (!matchesStatusFilter(e, statusFilter)) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    return true;
  });

  const handleDelete = async (exam: Exam) => {
    if (!window.confirm(`"${exam.title}" sınavını silmek istediğinize emin misiniz?`)) return;
    setDeletingId(exam.id);
    try {
      const res = await fetch(`/api/admin/standalone-exams/${exam.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Sınav silinemedi', 'error');
        return;
      }
      toast('Sınav silindi', 'success');
      refetch();
    } catch {
      toast('Sınav silinirken hata oluştu', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchive = async (exam: Exam) => {
    try {
      const res = await fetch(`/api/admin/standalone-exams/${exam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error();
      toast(`"${exam.title}" arşivlendi`, 'success');
      refetch();
    } catch {
      toast('Arşivleme başarısız', 'error');
    }
  };

  const handleDuplicate = async (exam: Exam) => {
    try {
      const detailRes = await fetch(`/api/admin/standalone-exams/${exam.id}`);
      if (!detailRes.ok) throw new Error();
      const detail = await detailRes.json();

      const newExam = {
        title: `${exam.title} (Kopya)`,
        description: detail.description ?? '',
        category: detail.category ?? '',
        passingScore: detail.passingScore,
        maxAttempts: detail.maxAttempts,
        examDurationMinutes: detail.examDurationMinutes,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        isCompulsory: false,
        questions: (detail.questions ?? []).map((q: { text: string; points: number; options: { text: string; isCorrect: boolean }[] }) => ({
          text: q.text,
          points: q.points,
          correctOptionIndex: q.options.findIndex((o: { isCorrect: boolean }) => o.isCorrect),
          options: q.options.map((o: { text: string }) => o.text),
        })),
      };

      const res = await fetch('/api/admin/standalone-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam),
      });
      if (!res.ok) throw new Error();
      toast(`"${exam.title}" kopyalandı`, 'success');
      refetch();
    } catch {
      toast('Kopyalama başarısız', 'error');
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</div>
      </div>
    );
  }

  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (categoryFilter ? 1 : 0);

  const columns: ColumnDef<Exam>[] = [
    {
      accessorKey: 'title',
      header: 'Sınav Adı',
      size: 260,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--k-primary) 12%, transparent)' }}
          >
            <ClipboardList className="h-5 w-5" style={{ color: 'var(--k-primary)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--k-text-primary)' }}>
              {row.getValue('title')}
            </p>
            {row.original.category && (
              <span className="k-badge k-badge-info mt-0.5">
                {row.original.category}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'questionCount',
      header: 'Soru',
      size: 70,
      cell: ({ row }) => (
        <span className="font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
          {row.getValue('questionCount')}
        </span>
      ),
    },
    {
      accessorKey: 'assignedCount',
      header: 'Katılımcı',
      size: 90,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" style={{ color: 'var(--k-text-muted)' }} />
          <span className="font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
            {row.getValue('assignedCount')}
          </span>
        </div>
      ),
    },
    {
      id: 'passRate',
      header: 'Geçme %',
      size: 130,
      cell: ({ row }) => {
        const total = row.original.attemptCount;
        const passed = row.original.passedCount;
        const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const color =
          rate >= 80
            ? 'var(--k-success)'
            : rate >= 50
              ? 'var(--k-warning)'
              : rate > 0
                ? 'var(--k-error)'
                : 'var(--k-text-muted)';
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-16 rounded-full" style={{ background: 'var(--k-border)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${rate}%`,
                  background: color,
                  transition: 'width var(--transition-base)',
                }}
              />
            </div>
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color }}>
              {rate}%
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Durum',
      size: 100,
      cell: ({ row }) => {
        const status = getExamStatus(row.original);
        return (
          <span className={`k-badge k-badge-${status.variant}`}>
            {status.label}
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--k-text-secondary)' }}>
            {new Date(row.getValue('endDate') as string).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent hover:text-accent-foreground" aria-label="Sınav işlemleri">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2"
              onClick={() => router.push(`/admin/exams/${row.original.id}/results`)}
            >
              <Eye className="h-4 w-4" /> Sonuçları Gör
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onClick={() => router.push(`/admin/exams/${row.original.id}/edit`)}
            >
              <Edit className="h-4 w-4" /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => handleDuplicate(row.original)}>
              <Copy className="h-4 w-4" /> Kopyala
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => handleArchive(row.original)}>
              <Archive className="h-4 w-4" style={{ color: 'var(--k-info)' }} /> Arşivle
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-red-500"
              disabled={deletingId === row.original.id}
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-4 w-4" />
              {deletingId === row.original.id ? 'Siliniyor...' : 'Sil'}
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
            <span data-current="true">Sınavlar</span>
          </div>
          <h1 className="k-page-title">Sınav Yönetimi</h1>
          <p className="k-page-subtitle">
            <strong style={{ color: 'var(--k-text-primary)' }}>{stats.totalExams}</strong> toplam sınav ·{' '}
            <strong style={{ color: 'var(--k-success)' }}>{stats.activeExams}</strong> aktif ·{' '}
            <strong style={{ color: 'var(--k-text-primary)' }}>%{stats.avgPassRate}</strong> ortalama geçme
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/admin/exams/new')} className="k-btn k-btn-primary">
            <Plus size={15} /> Yeni Sınav
          </button>
        </div>
      </header>

      {/* KPI Kartları */}
      <section className="k-kpi-grid" aria-label="Sınav istatistikleri">
        {[
          { label: 'Toplam Sınav', value: stats.totalExams, icon: ClipboardList },
          { label: 'Aktif Sınav', value: stats.activeExams, icon: Calendar },
          { label: 'Toplam Katılım', value: stats.thisMonthAttempts, icon: Users },
          { label: 'Ort. Geçme', value: stats.avgPassRate, suffix: '%', icon: ClipboardList },
        ].map((kpi) => (
          <div key={kpi.label} className="k-kpi">
            <div className="k-kpi-top">
              <div>
                <div className="k-kpi-label">{kpi.label}</div>
                <div className="k-kpi-value">
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString('tr-TR') : kpi.value}
                  {kpi.suffix && <span className="text-base font-medium ml-1" style={{ color: 'var(--k-text-muted)' }}>{kpi.suffix}</span>}
                </div>
              </div>
              <div className="k-kpi-icon"><kpi.icon size={18} /></div>
            </div>
          </div>
        ))}
      </section>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--k-text-muted)' }}
        >
          Durum
        </span>
        <div className="k-tabs" role="tablist">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              role="tab"
              onClick={() => setStatusFilter(f.key)}
              aria-label={`Filtrele: ${f.label}`}
              aria-pressed={statusFilter === f.key}
              data-active={statusFilter === f.key ? 'true' : undefined}
              className="k-tab"
            >
              {f.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="k-input"
            style={{ maxWidth: 220, paddingTop: 6, paddingBottom: 6 }}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {activeFilters > 0 && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter(null);
            }}
            aria-label="Filtreleri temizle"
            className="k-btn k-btn-ghost k-btn-sm"
          >
            <X className="h-3 w-3" /> Temizle
          </button>
        )}
      </div>

      {/* Tablo */}
      <div className="k-card p-5">
        {filteredExams.length > 0 ? (
          <DataTable
            columns={columns}
            data={filteredExams}
            searchKey="title"
            searchPlaceholder="Sınav adı ara..."
          />
        ) : (
          <div className="text-sm text-center py-8" style={{ color: 'var(--k-text-muted)' }}>
            {allExams.length === 0
              ? 'Henüz sınav oluşturulmamış. "Yeni Sınav" butonuna tıklayarak başlayın.'
              : 'Filtrelere uygun sınav bulunamadı.'}
          </div>
        )}
      </div>
    </div>
  );
}
