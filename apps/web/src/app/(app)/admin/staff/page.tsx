'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PeriodSelector } from '@/components/shared/period-selector';
import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import {
  Users, Plus, Upload, Download, MoreHorizontal, Edit,
  Building2, Trash2, UserPlus, ChevronRight, ChevronDown, X, Save, History, Award,
  Layers, GraduationCap, UserMinus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/data-table';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { isSyntheticEmail } from '@/lib/synthetic-email';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import dynamic from 'next/dynamic';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

import { K } from './_lib/palette';
import { DEPARTMENT_COLORS, semanticDeptColor } from './_lib/department-colors';
import { scoreColor, progressVariant } from './_lib/score-color';
import type { Staff, StaffPageData } from './_types';
import { Field } from './_components/field';
import { KStatCard } from '@/components/admin/k-stat-card';
import { StaffActions } from './_components/staff-actions';
import { NewStaffModal } from './_components/new-staff-modal';
import { AssignStaffModal } from './_components/assign-staff-modal';

const BulkImportDialog = dynamic(
  () => import('./bulk-import-dialog').then(m => ({ default: m.BulkImportDialog })),
  { ssr: false }
);

const AssignTrainingModal = dynamic(
  () => import('./assign-training-modal').then(m => ({ default: m.AssignTrainingModal })),
  { ssr: false }
);

/** Personel durum metnini k-badge varyantına çevirir (Aktif/Pasif/Beklemede). */
function statusVariant(status: string): 'success' | 'warning' | 'error' | 'muted' {
  const s = status.toLocaleLowerCase('tr-TR');
  if (s.includes('beklemede') || s.includes('davet') || s.includes('pending')) return 'warning';
  if (s.includes('pasif') || s.includes('inactive') || s.includes('kilit') || s.includes('locked')) return 'error';
  if (s.includes('aktif')) return 'success';
  return 'muted';
}

export default function StaffPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  // Görünüm durumu URL'den başlatılır → detaydan "geri" gelince aynı departman/sayfa/arama korunur.
  const [currentPage, setCurrentPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isInteger(p) && p > 0 ? p : 1;
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [activeView, setActiveView] = useState<'all' | 'departments'>(
    () => (searchParams.get('view') === 'all' ? 'all' : 'departments'),
  );
  const [selectedDept, setSelectedDept] = useState<string | null>(() => searchParams.get('dept'));
  const [periodId, setPeriodId] = useState<string | null>(searchParams.get('periodId'));
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = useState(10);
  // Toplu seçim + toplu işlem
  const [selectedStaff, setSelectedStaff] = useState<Staff[]>([]);
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkDeactivateConfirm, setBulkDeactivateConfirm] = useState(false);
  const [bulkDeactivating, setBulkDeactivating] = useState(false);
  // Departman silme onayı — window.confirm yerine markalı modal (etkilenen sayıyı gösterir)
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<{ id: string; name: string; staffCount: number } | null>(null);

  // Görünüm durumunu (view/dept/arama/sayfa/dönem) URL'e yansıt — geri navigasyonunda
  // bağlam korunur. Tek bir senkron effect; yalnız fark varsa router.replace yapar.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeView === 'all') params.set('view', 'all');
    if (selectedDept) params.set('dept', selectedDept);
    if (searchQuery) params.set('q', searchQuery);
    if (currentPage > 1) params.set('page', String(currentPage));
    if (periodId) params.set('periodId', periodId);
    const qs = params.toString();
    const currentQs = searchParams.toString();
    if (qs === currentQs) return;
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [activeView, selectedDept, searchQuery, currentPage, periodId, router, searchParams]);

  const sortKey = sorting[0]?.id;
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc';
  const { data, isLoading, refetch } = useFetch<StaffPageData>(
    `/api/admin/staff?page=${currentPage}&limit=${pageSize}&isActive=true${selectedDept ? `&department=${selectedDept}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}${periodId ? `&periodId=${periodId}` : ''}${sortKey ? `&sort=${sortKey}&order=${sortOrder}` : ''}`
  );
  // Mutasyon sonrası: in-memory cache + HTTP cache her ikisini de bypass'la
  const refreshDepartments = useCallback(() => {
    invalidateFetchCache('/api/admin/staff');
    refetch();
  }, [refetch]);

  // Debounce search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
      setCurrentPage(1);
    }, 300);
  }, []);

  // Sekme/departman/geri reset'lerinde bekleyen debounce timer'ını da iptal et;
  // yoksa reset sonrası timer ateşlenip eski arama terimini geri uygular.
  const resetSearch = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchQuery('');
  }, []);

  // Son sayfadaki son kayıt silinince/pasifleşince totalPages düşebilir; currentPage'i
  // sınırla ki aralık-dışı boş sayfada kalınmasın.
  useEffect(() => {
    if (data?.totalPages && currentPage > data.totalPages) {
      setCurrentPage(data.totalPages);
    }
  }, [data?.totalPages, currentPage]);

  // Sıralama / sayfa boyutu değişince sayfa 1'e dön (sunucu-taraflı)
  const handleSortingChange = useCallback((s: SortingState) => {
    setSorting(s);
    setCurrentPage(1);
  }, []);
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Seçimi temizle (DataTable'a reset tetiği gönder + parent state'i boşalt)
  const clearSelection = useCallback(() => {
    setSelectedStaff([]);
    setSelectionResetKey(k => k + 1);
  }, []);

  // Toplu pasifleştir — mevcut DELETE /[id] (soft delete) üzerinden, Promise.all
  const handleBulkDeactivate = useCallback(async () => {
    if (selectedStaff.length === 0) return;
    setBulkDeactivating(true);
    try {
      const results = await Promise.all(
        selectedStaff.map(s => fetch(`/api/admin/staff/${s.id}`, { method: 'DELETE' })),
      );
      const failed = results.filter(r => !r.ok).length;
      const ok = results.length - failed;
      if (ok > 0) toast(`${ok} personel pasifleştirildi`, 'success');
      if (failed > 0) toast(`${failed} personel pasifleştirilemedi`, 'error');
      setBulkDeactivateConfirm(false);
      clearSelection();
      refreshDepartments();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setBulkDeactivating(false);
    }
  }, [selectedStaff, toast, clearSelection, refreshDepartments]);

  // Seçili personeli Excel olarak indir — export route'una id listesini geçir
  const handleBulkExport = useCallback(() => {
    if (selectedStaff.length === 0) return;
    const ids = selectedStaff.map(s => s.id).join(',');
    window.location.href = `/api/admin/staff/export?ids=${encodeURIComponent(ids)}`;
  }, [selectedStaff]);

  // Departman silme — markalı modal onayı (window.confirm yerine)
  const handleConfirmDeleteDept = useCallback(async () => {
    const dept = deleteDeptTarget;
    if (!dept) return;
    setDeletingDeptId(dept.id);
    try {
      const res = await fetch(`/api/admin/departments/${dept.id}`, { method: 'DELETE' });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData.error || 'Departman silinemedi');
      toast('Departman silindi', 'success');
      if (selectedDept === dept.id) { setSelectedDept(null); setCurrentPage(1); resetSearch(); }
      setDeleteDeptTarget(null);
      refreshDepartments();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Departman silinemedi', 'error');
    } finally {
      setDeletingDeptId(null);
    }
  }, [deleteDeptTarget, selectedDept, toast, resetSearch, refreshDepartments]);

  // Seçim varken görünen toplu işlem çubuğu (iki tablo görünümünde de kullanılır)
  const bulkBar = selectedStaff.length > 0 ? (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: 'var(--k-primary)', background: 'var(--k-primary-light)' }}
      role="region"
      aria-label="Toplu işlemler"
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--k-primary)' }}>
        {selectedStaff.length} personel seçildi
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" className="k-btn k-btn-ghost" onClick={() => setBulkAssignOpen(true)}>
          <GraduationCap size={15} /> Eğitim Ata
        </button>
        <button type="button" className="k-btn k-btn-ghost" onClick={handleBulkExport}>
          <Download size={15} /> Excel İndir
        </button>
        <button
          type="button"
          className="k-btn k-btn-ghost"
          style={{ color: 'var(--k-error)', borderColor: 'var(--k-error-bg)' }}
          onClick={() => setBulkDeactivateConfirm(true)}
        >
          <UserMinus size={15} /> Pasifleştir
        </button>
        <button
          type="button"
          className="k-btn k-btn-ghost"
          onClick={clearSelection}
          aria-label="Seçimi temizle"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  ) : null;

  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState(DEPARTMENT_COLORS[0]);
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; color: string; parentId: string | null } | null>(null);
  const [editDeptSaving, setEditDeptSaving] = useState(false);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);

  // Alt departman ekleme state'i — parent context'i kart menüsünden gelir
  const [subDeptParent, setSubDeptParent] = useState<{ id: string; name: string; color: string } | null>(null);
  const [subDeptName, setSubDeptName] = useState('');
  const [subDeptColor, setSubDeptColor] = useState(DEPARTMENT_COLORS[0]);
  const [isSavingSubDept, setIsSavingSubDept] = useState(false);

  // Departman kart genişletme: hangi root dept'lerin alt birimleri açık.
  // Default uniform yükseklik için tümü gizli; chevron toggle ile açılır.
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const toggleDeptExpand = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allStaff = useMemo(() => data?.staff ?? [], [data]);
  const allDepartments = useMemo(() => data?.departments ?? [], [data]);

  const departmentMap = useMemo(
    () => new Map(allDepartments.map(d => [d.id, d])),
    [allDepartments]
  );
  // parentId → alt departman listesi (tek pass, O(n))
  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof allDepartments>();
    for (const d of allDepartments) {
      if (!d.parentId) continue;
      const list = map.get(d.parentId);
      if (list) list.push(d);
      else map.set(d.parentId, [d]);
    }
    return map;
  }, [allDepartments]);
  const rootDepartments = useMemo(
    () => allDepartments.filter(d => !d.parentId),
    [allDepartments]
  );
  // Seçili kök departmanın rengi — null ise "Tüm Personel" tab'ı veya
  // departman seçilmemiş. Tablo cell'lerinde avatar/badge bu rengi alır
  // (kullanıcı kararı: BAŞHEKİMLİK seçince hepsi mor olsun, alt birim
  // bilgisi badge METNİYLE okunur). Null ise her satır kendi alt birim
  // rengini gösterir (Tüm Personel tab'ında orientation için).
  const selectedDeptColor = useMemo(() => {
    if (!selectedDept) return null;
    const dept = departmentMap.get(selectedDept);
    if (!dept) return null;
    return semanticDeptColor(dept.name) ?? dept.color;
  }, [selectedDept, departmentMap]);

  const columns: ColumnDef<Staff>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Personel',
      size: 250,
      cell: ({ row }) => {
        const dept = departmentMap.get(row.original.departmentId ?? '');
        const ownColor = dept ? (semanticDeptColor(dept.name) ?? dept.color) : 'var(--k-primary)';
        const color = selectedDeptColor ?? ownColor;
        return (
          <div className="k-person">
            <div className="k-person-avatar" style={{ background: color }}>
              {row.original.initials}
            </div>
            <div className="k-person-meta">
              <p className="k-person-name">{row.getValue('name')}</p>
              <p className="k-person-email">{isSyntheticEmail(row.original.email) ? '—' : row.original.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Departman',
      size: 140,
      cell: ({ row }) => {
        const dept = departmentMap.get(row.original.departmentId ?? '');
        const ownColor = dept ? (semanticDeptColor(dept.name) ?? dept.color) : 'var(--k-primary)';
        const color = selectedDeptColor ?? ownColor;
        return (
          // Renk dot'ta + tint arka planda; metin sabit koyu (var(--k-text-secondary)) →
          // açık hue'larda (amber/turuncu) okunabilir kalır (WCAG AA kontrast).
          <span className="k-badge k-badge-no-dot"
                style={{ background: `${color}20`, color: 'var(--k-text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {row.getValue('department')}
          </span>
        );
      },
    },
    {
      accessorKey: 'title',
      header: 'Unvan',
      size: 120,
      cell: ({ row }) => (
        <span className="text-sm truncate block" style={{ color: 'var(--k-text-secondary)' }}>
          {row.getValue('title')}
        </span>
      ),
    },
    {
      accessorKey: 'completedTrainings',
      header: 'Eğitim',
      size: 160,
      // Hesaplanmış kolon — sunucuda tüm-veri sıralaması yapılamaz (bkz. route buildStaffOrderBy)
      enableSorting: false,
      cell: ({ row }) => {
        const total = row.original.assignedTrainings || 1;
        const done = Number(row.getValue('completedTrainings')) || 0;
        const pct = Math.min(100, Math.round((done / total) * 100));
        return (
          <div className="flex items-center gap-2">
            <div className="k-progress flex-1">
              <div className="k-progress-fill" style={{ width: `${pct}%` }} data-variant={progressVariant(pct)} />
            </div>
            <span className="text-xs font-mono tabular-nums w-12 text-right" style={{ color: 'var(--k-text-secondary)' }}>
              {done}/{row.original.assignedTrainings}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'avgScore',
      header: 'Ort. Puan',
      size: 90,
      // Hesaplanmış kolon — sunucuda tüm-veri sıralaması yapılamaz (bkz. route buildStaffOrderBy)
      enableSorting: false,
      cell: ({ row }) => {
        const score = row.getValue('avgScore') as number;
        return <span className="text-sm font-mono font-bold" style={{ color: scoreColor(score) }}>{score}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      size: 90,
      // Paylaşılan k-badge varyantları (exams/trainings ile tutarlı) — inline stil + kırılgan
      // string eşleme yerine. k-badge-success koyu --k-success kullanır → WCAG AA kontrast.
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = statusVariant(status);
        return <span className={`k-badge k-badge-${variant}`}>{status}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => <StaffActions staff={row.original} onChanged={refreshDepartments} />,
    },
  ], [departmentMap, refreshDepartments, selectedDeptColor]);

  // Mobil (≤767px) kart görünümü — auto-render'da progress bar ~0px'e çöküyordu.
  // İsim/departman/tam-genişlik progress/puan/durum/aksiyon yığılmış kart.
  const renderMobileStaffCard = useCallback((s: Staff) => {
    const dept = departmentMap.get(s.departmentId ?? '');
    const ownColor = dept ? (semanticDeptColor(dept.name) ?? dept.color) : 'var(--k-primary)';
    const color = selectedDeptColor ?? ownColor;
    const total = s.assignedTrainings || 1;
    const done = s.completedTrainings || 0;
    const pct = Math.min(100, Math.round((done / total) * 100));
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="k-person">
            <div className="k-person-avatar" style={{ background: color }}>{s.initials}</div>
            <div className="k-person-meta">
              <p className="k-person-name">{s.name}</p>
              <p className="k-person-email">{isSyntheticEmail(s.email) ? '—' : s.email}</p>
            </div>
          </div>
          <StaffActions staff={s} onChanged={refreshDepartments} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="k-badge k-badge-no-dot" style={{ background: `${color}20`, color: 'var(--k-text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {s.department || 'Departmansız'}
          </span>
          <span className={`k-badge k-badge-${statusVariant(s.status)}`}>{s.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="k-progress flex-1">
            <div className="k-progress-fill" style={{ width: `${pct}%` }} data-variant={progressVariant(pct)} />
          </div>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--k-text-secondary)' }}>{done}/{s.assignedTrainings}</span>
        </div>
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--k-text-muted)' }}>
          <span>Ort. Puan</span>
          <span className="font-mono font-bold" style={{ color: scoreColor(s.avgScore) }}>{s.avgScore}%</span>
        </div>
      </div>
    );
  }, [departmentMap, selectedDeptColor, refreshDepartments]);

  // Sadece initial mount'ta (henüz hiç veri yokken) tam sayfa loading göster.
  // Arama/sayfalama/filtre değişimlerinde data hâlâ var, isLoading true olabilir
  // ama background fetch sırasında tabloyu eski veriyle göstermeye devam ederiz —
  // aksi halde her input tuşunda PageLoading flash'ı "sayfa yenileniyor" hissi
  // yaratır (kullanıcı raporu: arama input'una yazınca sayfa kendini yeniliyor).
  if (isLoading && !data) {
    return <PageLoading />;
  }

  const statsData = data?.stats ?? { totalStaff: 0, activeStaff: 0, departmentCount: 0, avgScore: 0 };
  const filteredStaff = allStaff;
  const selectedDeptData = selectedDept ? departmentMap.get(selectedDept) : null;
  // Header rendering için renk — selectedDeptColor (yukarıdaki useMemo) null
  // dönerse primary fallback. Body genelinde aynı pattern kullanılır.
  const selectedDeptColorOrPrimary = selectedDeptColor ?? 'var(--k-primary)';

  return (
    <div className="k-page">
      {/* Arka plan fetch göstergesi (arama/sayfa/dönem/sıralama) — tam-sayfa flash yerine
          layout-shift'siz ince üst bar. data zaten var, sadece isLoading=true iken görünür. */}
      {isLoading && (
        <div
          aria-hidden
          className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse"
          style={{ background: 'var(--k-primary)' }}
        />
      )}
      {/* Header */}
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Personel</span>
          </div>
          <h1 className="k-page-title">Personel Yönetimi</h1>
          <p className="k-page-subtitle">
            {statsData.totalStaff > 0 ? (
              <>
                <strong style={{ color: 'var(--k-text-primary)' }}>{statsData.totalStaff}</strong> kayıtlı personel ·{' '}
                <strong style={{ color: 'var(--k-text-primary)' }}>{statsData.activeStaff}</strong> aktif ·{' '}
                <strong style={{ color: 'var(--k-text-primary)' }}>{statsData.departmentCount}</strong> departman
              </>
            ) : 'Departmanları düzenle, yeni personel ekle, performans verilerini incele.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push('/admin/staff/imports')}
            className="k-btn k-btn-ghost k-btn-sm"
            title="Toplu yükleme geçmişi"
          >
            <History size={14} /> Yükleme Geçmişi
          </button>
          <button
            onClick={() => { window.location.href = '/api/admin/staff/export'; }}
            className="k-btn k-btn-ghost"
            title="Tüm personeli toplu yükleme şablonu formatında Excel olarak indir"
          >
            <Download size={15} /> Excel İndir
          </button>
          <button onClick={() => setShowBulkImport(true)} className="k-btn k-btn-ghost">
            <Upload size={15} /> Toplu Yükle
          </button>
          <button onClick={() => setShowAddStaff(true)} className="k-btn k-btn-primary">
            <Plus size={15} /> Yeni Personel
          </button>
        </div>
      </header>

      {/* Eğitim Dönemi seçici — trigger'ın kendi eyebrow'u var, dış label'a gerek yok */}
      <div className="flex flex-wrap">
        <PeriodSelector value={periodId} onChange={(id) => { setPeriodId(id); setCurrentPage(1); }} includeAll />
      </div>

      {/* KPIs */}
      <section className="k-kpi-grid" aria-label="Personel istatistikleri">
        <KStatCard icon={Users} title="Toplam Personel" value={statsData.totalStaff} accentColor="var(--k-primary)" />
        <KStatCard icon={Users} title="Aktif" value={statsData.activeStaff} accentColor="var(--k-success)" />
        <KStatCard icon={Building2} title="Departman" value={statsData.departmentCount} accentColor="var(--k-info)" />
        <KStatCard icon={Award} title="Ort. Başarı" value={`${statsData.avgScore}%`} accentColor="var(--k-warning)" />
      </section>

      {/* View toggle */}
      <div>
        <div className="k-tabs" role="tablist" aria-label="Görünüm seçimi">
          {([
            { key: 'departments' as const, label: 'Departmanlar', icon: Building2 },
            { key: 'all' as const, label: 'Tüm Personel', icon: Users },
          ]).map(v => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                role="tab"
                aria-selected={activeView === v.key}
                className="k-tab"
                data-active={activeView === v.key}
                onClick={() => { setActiveView(v.key); setSelectedDept(null); setCurrentPage(1); resetSearch(); }}
              >
                <Icon size={14} />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Department grid */}
      {activeView === 'departments' && !selectedDept && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', alignItems: 'stretch' }}>
          {rootDepartments.map(dept => {
            const deptColor = semanticDeptColor(dept.name) ?? dept.color;
            const children = childrenByParent.get(dept.id) ?? [];
            const isExpanded = expandedDepts.has(dept.id);
            // A11y: kart artık role="button" DEĞİL (iç içe buton geçersiz ARIA idi).
            // Açma aksiyonu başlık butonunda; stretched ::after overlay ile tüm-kart
            // tıklaması korunur. İç kontroller (menü/chevron/alt birim) relative z-10.
            return (
            <article
              key={dept.id}
              className="k-card group relative p-5 transition-all hover:-translate-y-0.5 flex flex-col"
              style={{ borderLeft: `3px solid ${deptColor}`, minHeight: 200 }}
            >
              <div className="relative z-10 flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${deptColor}1f`, color: deptColor }}
                >
                  <Building2 size={16} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    /* Her zaman görünür (eskiden opacity-0 group-hover idi → dokunmada
                       erişilemiyordu; "Alt Departman Ekle" buranın tek giriş noktası). */
                    className="w-7 h-7 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-(--k-surface-hover) transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Departman işlemleri"
                  >
                    <MoreHorizontal size={14} style={{ color: 'var(--k-text-muted)' }} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    style={{
                      background: K.SURFACE,
                      border: `1.5px solid ${K.BORDER}`,
                      borderRadius: 14,
                      boxShadow: K.SHADOW_CARD,
                      padding: 6,
                      minWidth: 200,
                    }}
                  >
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={(e) => { e.stopPropagation(); setEditingDept({ id: dept.id, name: dept.name, color: dept.color, parentId: dept.parentId ?? null }); }}
                      style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
                    >
                      <Edit className="h-4 w-4" /> Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={(e) => { e.stopPropagation(); setSelectedDept(dept.id); setShowAssignStaff(true); }}
                      style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
                    >
                      <UserPlus className="h-4 w-4" /> Personel Ekle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubDeptParent({ id: dept.id, name: dept.name, color: deptColor });
                        setSubDeptName('');
                        setSubDeptColor(deptColor);
                      }}
                      style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
                    >
                      <Plus className="h-4 w-4" /> Alt Departman Ekle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
                    <DropdownMenuItem
                      className="gap-2"
                      style={{ borderRadius: 8, color: K.ERROR, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}
                      disabled={deletingDeptId === dept.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deletingDeptId) return;
                        setDeleteDeptTarget({ id: dept.id, name: dept.name, staffCount: dept.staffCount });
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> {deletingDeptId === dept.id ? 'Siliniyor...' : 'Departmanı Sil'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Chevron expand toggle — sadece alt birim varsa görünür.
                    Default kapalı: kart uniform yükseklik. Kullanıcı ister
                    alt birim adlarını görebilir; kapalıyken sadece sayı şeridi. */}
                {children.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleDeptExpand(dept.id); }}
                    aria-label={isExpanded ? 'Alt birimleri gizle' : 'Alt birimleri göster'}
                    aria-expanded={isExpanded}
                    title={isExpanded ? 'Alt birimleri gizle' : `${children.length} alt birimi göster`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-(--k-surface-hover) transition-colors"
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        color: 'var(--k-text-muted)',
                        transition: 'transform 180ms ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                )}
              </div>

              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedDept(dept.id); setCurrentPage(1); resetSearch(); }}
                  className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--k-primary) rounded"
                  style={{ color: 'inherit', background: 'none', font: 'inherit', cursor: 'pointer' }}
                  aria-label={`${dept.name} departmanını aç`}
                >
                  {dept.name}
                </button>
              </h3>
              {dept.description && (
                <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--k-text-muted)' }}>
                  {dept.description}
                </p>
              )}

              {/* Default (collapsed): sadece sayı — uniform yükseklik için minimal şerit */}
              {children.length > 0 && !isExpanded && (
                <div className="mb-3 inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-md text-[11px] font-medium"
                     style={{ background: `${deptColor}10`, color: deptColor }}>
                  <Layers size={11} strokeWidth={2.5} />
                  <span className="tabular-nums">{children.length} alt birim</span>
                </div>
              )}

              {/* Expanded: alt birim listesi açılır. Kart yüksekliği esner;
                  diğer kartlar grid satır bağımsızlığıyla etkilenmez. */}
              {children.length > 0 && isExpanded && (
                <div className="relative z-10 mb-3" aria-label="Alt departmanlar">
                  <div
                    className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--k-text-muted)' }}
                  >
                    <span>Alt Birimler</span>
                    <span className="tabular-nums" style={{ color: 'var(--k-text-muted)' }}>· {children.length}</span>
                  </div>
                  <ul className="flex flex-col -mx-1.5">
                    {children.map(child => {
                      const childColor = semanticDeptColor(child.name) ?? child.color;
                      return (
                        <li key={child.id}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedDept(child.id); setCurrentPage(1); resetSearch(); }}
                            className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md text-xs hover:bg-[color:var(--k-surface-hover)] focus-visible:bg-[color:var(--k-surface-hover)] focus-visible:outline-none"
                            title={`${child.staffCount} personel`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: childColor }}
                              aria-hidden
                            />
                            <span
                              className="flex-1 text-left truncate font-medium"
                              style={{ color: 'var(--k-text-primary)' }}
                            >
                              {child.name}
                            </span>
                            <span
                              className="tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ color: childColor, background: `${childColor}14` }}
                            >
                              {child.staffCount}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-3 border-t mt-auto" style={{ borderColor: 'var(--k-border)' }}>
                {/* Departman-renkli kişi rozeti. Eski avatar yığını sayfalanmış (≤10)
                    listeden çiziliyordu → çoğu departman için boş/yanlış avatar gösteriyordu,
                    kaldırıldı. Doğru sayı dept.staffCount (sunucu rollup) üzerinden. */}
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: `${deptColor}1f`, color: deptColor }}
                  aria-hidden
                >
                  <Users size={13} />
                </span>
                <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--k-text-muted)' }}>
                  <strong style={{ color: 'var(--k-text-primary)' }}>{dept.staffCount}</strong> kişi
                </span>
                <ChevronRight size={14} style={{ color: 'var(--k-text-muted)' }} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </article>
            );
          })}

          {/* New Department tile / inline editor */}
          {!showAddDept ? (
            <button
              onClick={() => setShowAddDept(true)}
              className="flex flex-col items-center justify-center gap-2.5 min-h-45 p-7 rounded-2xl border-2 border-dashed transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--k-border)', color: 'var(--k-text-muted)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: 'var(--k-surface-hover)' }}>
                <Plus size={18} />
              </div>
              <span className="text-sm font-semibold">Yeni Departman</span>
            </button>
          ) : (
            <div className="k-card p-5 flex flex-col gap-3" style={{ borderColor: 'var(--k-primary)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                  Yeni Departman
                </span>
                <button onClick={() => setShowAddDept(false)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-(--k-surface-hover)" aria-label="Kapat">
                  <X size={14} style={{ color: 'var(--k-text-muted)' }} />
                </button>
              </div>
              <Field label="Departman Adı">
                <Input
                  autoFocus
                  placeholder="Örn: Kardiyoloji"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="h-10"
                  style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
                />
              </Field>
              <Field label="Renk">
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_COLORS.map(c => {
                    const active = newDeptColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewDeptColor(c)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-transform hover:scale-110"
                        style={{
                          background: c,
                          outline: active ? `2px solid var(--k-text-primary)` : 'none',
                          outlineOffset: 2,
                        }}
                        aria-pressed={active}
                        aria-label={`Renk seçeneği${active ? ' (seçili)' : ''}`}
                      >
                        {active && '✓'}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <button
                className="k-btn k-btn-primary w-full"
                disabled={!newDeptName.trim() || isSavingDept}
                onClick={async () => {
                  setIsSavingDept(true);
                  try {
                    const parentName = newDeptName.trim();
                    const res = await fetch('/api/admin/departments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: parentName, color: newDeptColor }),
                    });
                    const resData = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(resData.error || 'Departman oluşturulamadı');

                    toast(`"${parentName}" departmanı oluşturuldu`, 'success');
                    setShowAddDept(false);
                    setNewDeptName('');
                    refreshDepartments();
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
                  } finally {
                    setIsSavingDept(false);
                  }
                }}
              >
                {isSavingDept ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : <Plus size={15} />}
                {isSavingDept ? 'Oluşturuluyor…' : 'Departman Oluştur'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected department detail + table */}
      {activeView === 'departments' && selectedDept && selectedDeptData && (
        <section className="flex flex-col gap-4">
          <header className="k-card flex flex-wrap items-center gap-5 p-5" style={{ borderLeft: `3px solid ${selectedDeptColorOrPrimary}` }}>
            <button
              onClick={() => { setSelectedDept(null); setCurrentPage(1); resetSearch(); }}
              className="k-btn k-btn-subtle k-btn-sm"
              aria-label="Departmanlara dön"
            >
              <ChevronRight size={14} className="rotate-180" /> Tüm Departmanlar
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-50">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: `${selectedDeptColorOrPrimary}20`, color: selectedDeptColorOrPrimary }}>
                <Building2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                  Departman
                </span>
                <h2 className="text-xl font-bold" style={{ color: 'var(--k-text-primary)' }}>
                  {selectedDeptData.name}
                </h2>
                <p className="text-xs tabular-nums" style={{ color: 'var(--k-text-muted)' }}>
                  <strong style={{ color: 'var(--k-text-primary)' }}>{data?.total ?? filteredStaff.length}</strong> personel
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="k-btn k-btn-ghost" onClick={() => setShowAssignStaff(true)}>
                <UserPlus size={15} /> Personel Ekle
              </button>
              <button
                className="k-btn k-btn-ghost"
                onClick={() => { window.location.href = `/api/admin/staff/export?department=${selectedDept}`; }}
                title="Bu departmanı (alt birimler dahil) Excel olarak indir"
              >
                <Download size={15} /> İndir
              </button>
              <button className="k-btn k-btn-ghost" onClick={() => setEditingDept({ id: selectedDeptData.id, name: selectedDeptData.name, color: selectedDeptData.color, parentId: selectedDeptData.parentId ?? null })}>
                <Edit size={15} /> Düzenle
              </button>
              <button
                className="k-btn k-btn-ghost"
                style={{ color: 'var(--k-error)', borderColor: 'var(--k-error-bg)' }}
                disabled={deletingDeptId === selectedDept}
                onClick={() => {
                  if (deletingDeptId) return;
                  setDeleteDeptTarget({ id: selectedDeptData.id, name: selectedDeptData.name, staffCount: selectedDeptData.staffCount });
                }}
              >
                <Trash2 size={15} /> {deletingDeptId === selectedDept ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </header>

          <div className="k-card p-5">
            {bulkBar}
            <DataTable
              key={`dept-${selectedDept}`}
              columns={columns}
              data={filteredStaff}
              searchKey="name"
              searchPlaceholder="Bu departmanda ara..."
              defaultSearch={searchQuery}
              mobileCardRenderer={renderMobileStaffCard}
              onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)}
              totalCount={data?.total}
              pageCount={data?.totalPages}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onSearchChange={handleSearch}
              sorting={sorting}
              onSortingChange={handleSortingChange}
              enableRowSelection
              onSelectionChange={setSelectedStaff}
              getRowId={(s) => (s as Staff).id}
              selectionResetKey={selectionResetKey}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </section>
      )}

      {/* All staff view */}
      {activeView === 'all' && (
        <div className="k-card p-5">
          {bulkBar}
          <DataTable
            key="all-staff"
            columns={columns}
            data={allStaff}
            searchKey="name"
            searchPlaceholder="Personel ara (isim, e-posta)..."
            defaultSearch={searchQuery}
            mobileCardRenderer={renderMobileStaffCard}
            onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)}
            totalCount={data?.total}
            pageCount={data?.totalPages}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onSearchChange={handleSearch}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            enableRowSelection
            onSelectionChange={setSelectedStaff}
            getRowId={(s) => (s as Staff).id}
            selectionResetKey={selectionResetKey}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {/* Edit Department Modal */}
      <PremiumModal
        isOpen={!!editingDept}
        onClose={() => { if (!editDeptSaving) setEditingDept(null); }}
        eyebrow="Departman"
        title="Departmanı düzenle"
        subtitle="Ad ve renk aynı anda güncellenir."
        size="md"
        disableEscape={editDeptSaving}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton variant="ghost" onClick={() => setEditingDept(null)} disabled={editDeptSaving}>İptal</PremiumButton>
                <PremiumButton
                  disabled={!editingDept?.name.trim()}
                  loading={editDeptSaving}
                  icon={<Save className="h-4 w-4" />}
                  onClick={async () => {
                    if (!editingDept) return;
                    setEditDeptSaving(true);
                    try {
                      const res = await fetch(`/api/admin/departments/${editingDept.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: editingDept.name,
                          color: editingDept.color,
                          parentId: editingDept.parentId ?? null,
                        }),
                      });
                      const resData = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(resData.error || 'Güncellenemedi');
                      toast('Departman güncellendi', 'success');
                      setEditingDept(null);
                      refreshDepartments();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Departman güncellenemedi', 'error');
                    } finally {
                      setEditDeptSaving(false);
                    }
                  }}
                >
                  {editDeptSaving ? 'Kaydediliyor' : 'Kaydet'}
                </PremiumButton>
              </>
            }
          />
        }
      >
        {editingDept && (
          <div className="flex flex-col gap-5">
            <Field label="Departman Adı">
              <Input
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="h-10"
                style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
              />
            </Field>
            <Field label="Alt Departman (opsiyonel)">
              <select
                value={editingDept.parentId ?? ''}
                onChange={(e) => setEditingDept({ ...editingDept, parentId: e.target.value || null })}
                className="k-input h-10 w-full"
                style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
              >
                <option value="">Hayır — kök departman</option>
                {allDepartments
                  .filter(d => d.id !== editingDept.id && !d.parentId)
                  .map(d => (
                    <option key={d.id} value={d.id}>Evet — {d.name} altına</option>
                  ))}
              </select>
            </Field>
            <Field label="Renk">
              <div className="flex flex-wrap gap-2.5">
                {DEPARTMENT_COLORS.map(c => {
                  const active = editingDept.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingDept({ ...editingDept, color: c })}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-transform hover:scale-110"
                      style={{
                        background: c,
                        outline: active ? `2px solid var(--k-text-primary)` : 'none',
                        outlineOffset: 2,
                      }}
                      aria-pressed={active}
                      aria-label={`Renk seçeneği${active ? ' (seçili)' : ''}`}
                    >
                      {active && '✓'}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--k-border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                Önizleme
              </span>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border"
                   style={{ borderColor: `${editingDept.color}40`, background: `${editingDept.color}0c` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                     style={{ background: `${editingDept.color}20`, color: editingDept.color }}>
                  <Building2 size={16} />
                </div>
                <span className="text-base font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                  {editingDept.name || 'Departman adı'}
                </span>
              </div>
            </div>
          </div>
        )}
      </PremiumModal>

      {/* Alt Departman Ekle Modal */}
      <PremiumModal
        isOpen={!!subDeptParent}
        onClose={() => { if (!isSavingSubDept) setSubDeptParent(null); }}
        eyebrow={subDeptParent ? `${subDeptParent.name} altına` : 'Alt Departman'}
        title="Alt departman ekle"
        subtitle={subDeptParent ? `Bu departman, "${subDeptParent.name}" altında listelenir.` : undefined}
        size="md"
        disableEscape={isSavingSubDept}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton variant="ghost" onClick={() => setSubDeptParent(null)} disabled={isSavingSubDept}>İptal</PremiumButton>
                <PremiumButton
                  disabled={!subDeptName.trim()}
                  loading={isSavingSubDept}
                  icon={<Plus className="h-4 w-4" />}
                  onClick={async () => {
                    if (!subDeptParent) return;
                    setIsSavingSubDept(true);
                    try {
                      const res = await fetch('/api/admin/departments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: subDeptName.trim(),
                          color: subDeptColor,
                          parentId: subDeptParent.id,
                        }),
                      });
                      const resData = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(resData.error || 'Alt departman oluşturulamadı');
                      toast(`"${subDeptName.trim()}" alt departmanı oluşturuldu`, 'success');
                      setSubDeptParent(null);
                      setSubDeptName('');
                      refreshDepartments();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
                    } finally {
                      setIsSavingSubDept(false);
                    }
                  }}
                >
                  {isSavingSubDept ? 'Oluşturuluyor' : 'Oluştur'}
                </PremiumButton>
              </>
            }
          />
        }
      >
        {subDeptParent && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 p-3 rounded-xl"
                 style={{ background: `${subDeptParent.color}0c`, border: `1px solid ${subDeptParent.color}33` }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                   style={{ background: `${subDeptParent.color}20`, color: subDeptParent.color }}>
                <Building2 size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                  Üst Departman
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                  {subDeptParent.name}
                </span>
              </div>
            </div>
            <Field label="Alt Departman Adı">
              <Input
                placeholder="Örn: Endokrinoloji"
                value={subDeptName}
                onChange={(e) => setSubDeptName(e.target.value)}
                autoFocus
                className="h-10"
                style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
              />
            </Field>
            <Field label="Renk">
              <div className="flex flex-wrap gap-2.5">
                {DEPARTMENT_COLORS.map(c => {
                  const active = subDeptColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSubDeptColor(c)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold transition-transform hover:scale-110"
                      style={{
                        background: c,
                        outline: active ? `2px solid var(--k-text-primary)` : 'none',
                        outlineOffset: 2,
                      }}
                      aria-pressed={active}
                      aria-label={`Renk seçeneği${active ? ' (seçili)' : ''}`}
                    >
                      {active && '✓'}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}
      </PremiumModal>

      {showAddStaff && <NewStaffModal onClose={() => setShowAddStaff(false)} departments={allDepartments} onSaved={refetch} />}
      {showAssignStaff && selectedDept && (() => {
        const dept = departmentMap.get(selectedDept);
        return dept ? (
          <AssignStaffModal
            deptId={selectedDept}
            deptName={dept.name}
            onClose={() => setShowAssignStaff(false)}
            onSaved={refreshDepartments}
          />
        ) : null;
      })()}
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImported={refetch}
      />

      {/* Toplu eğitim atama — seçili personellere */}
      <AssignTrainingModal
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        userIds={selectedStaff.map(s => s.id)}
        targetLabel={`${selectedStaff.length} personel`}
        onSuccess={() => { clearSelection(); refreshDepartments(); }}
      />

      {/* Toplu pasifleştirme onayı */}
      <PremiumModal
        isOpen={bulkDeactivateConfirm}
        onClose={() => { if (!bulkDeactivating) setBulkDeactivateConfirm(false); }}
        eyebrow="Toplu İşlem"
        title="Seçili personeli pasifleştir"
        subtitle={`${selectedStaff.length} personel pasifleştirilecek. Giriş yapamazlar; geçmiş kayıtları korunur ve daha sonra yeniden aktifleştirilebilirler.`}
        size="md"
        disableEscape={bulkDeactivating}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton variant="ghost" onClick={() => setBulkDeactivateConfirm(false)} disabled={bulkDeactivating}>
                  Vazgeç
                </PremiumButton>
                <PremiumButton
                  onClick={handleBulkDeactivate}
                  loading={bulkDeactivating}
                  icon={<UserMinus className="h-4 w-4" />}
                >
                  {bulkDeactivating ? 'Pasifleştiriliyor' : `${selectedStaff.length} Personeli Pasifleştir`}
                </PremiumButton>
              </>
            }
          />
        }
      >
        <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
          Bu işlem geri alınabilir — personeli daha sonra düzenleme sayfasından yeniden aktifleştirebilirsiniz.
        </p>
      </PremiumModal>

      {/* Departman silme onayı — etkilenen personel + alt birim sayısını gösterir */}
      <PremiumModal
        isOpen={!!deleteDeptTarget}
        onClose={() => { if (deletingDeptId !== deleteDeptTarget?.id) setDeleteDeptTarget(null); }}
        eyebrow="Tehlikeli İşlem"
        title="Departmanı sil"
        subtitle={deleteDeptTarget ? `"${deleteDeptTarget.name}" departmanı silinecek.` : ''}
        size="md"
        disableEscape={!!deleteDeptTarget && deletingDeptId === deleteDeptTarget.id}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton
                  variant="ghost"
                  onClick={() => setDeleteDeptTarget(null)}
                  disabled={!!deleteDeptTarget && deletingDeptId === deleteDeptTarget.id}
                >
                  Vazgeç
                </PremiumButton>
                <PremiumButton
                  onClick={handleConfirmDeleteDept}
                  loading={!!deleteDeptTarget && deletingDeptId === deleteDeptTarget.id}
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  {!!deleteDeptTarget && deletingDeptId === deleteDeptTarget.id ? 'Siliniyor' : 'Sil'}
                </PremiumButton>
              </>
            }
          />
        }
      >
        {deleteDeptTarget && (() => {
          const childCount = childrenByParent.get(deleteDeptTarget.id)?.length ?? 0;
          return (
            <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              {deleteDeptTarget.staffCount > 0 && (
                <p>
                  <strong style={{ color: 'var(--k-error)' }}>{deleteDeptTarget.staffCount} personel</strong> bu departmanda
                  (alt birimler dahil). Silince bu personeller <strong>departmansız</strong> kalır; kayıtları korunur.
                </p>
              )}
              {childCount > 0 && (
                <p>
                  Bu departmanın <strong>{childCount} alt birimi</strong> var. Alt birimlerin bağı da kaldırılır.
                </p>
              )}
              <p>Bu işlem geri alınamaz.</p>
            </div>
          );
        })()}
      </PremiumModal>
    </div>
  );
}
