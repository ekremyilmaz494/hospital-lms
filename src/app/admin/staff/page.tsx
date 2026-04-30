'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Users, Plus, Upload, MoreHorizontal, Edit,
  Building2, Trash2, UserPlus, ChevronRight, X, Save, History, Award,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/data-table';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import dynamic from 'next/dynamic';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

import { K } from './_lib/palette';
import { DEPARTMENT_COLORS, semanticDeptColor } from './_lib/department-colors';
import type { Staff, StaffPageData } from './_types';
import { Field } from './_components/field';
import { Kpi } from './_components/kpi';
import { StaffActions } from './_components/staff-actions';
import { NewStaffModal } from './_components/new-staff-modal';
import { AssignStaffModal } from './_components/assign-staff-modal';

const BulkImportDialog = dynamic(
  () => import('./bulk-import-dialog').then(m => ({ default: m.BulkImportDialog })),
  { ssr: false }
);

export default function StaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'departments'>('departments');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const { data, isLoading, refetch } = useFetch<StaffPageData>(
    `/api/admin/staff?page=${currentPage}&limit=10${selectedDept ? `&department=${selectedDept}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
  );

  // Debounce search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
      setCurrentPage(1);
    }, 300);
  }, []);

  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState(DEPARTMENT_COLORS[0]);
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editDeptSaving, setEditDeptSaving] = useState(false);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);

  const allStaff = useMemo(() => data?.staff ?? [], [data]);
  const allDepartments = useMemo(() => data?.departments ?? [], [data]);

  const departmentMap = useMemo(
    () => new Map(allDepartments.map(d => [d.id, d])),
    [allDepartments]
  );
  const staffByDeptMap = useMemo(() => {
    const map = new Map<string, Staff[]>();
    for (const s of allStaff) {
      if (!s.departmentId) continue;
      const list = map.get(s.departmentId);
      if (list) list.push(s);
      else map.set(s.departmentId, [s]);
    }
    return map;
  }, [allStaff]);

  const columns: ColumnDef<Staff>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Personel',
      size: 250,
      cell: ({ row }) => {
        const dept = departmentMap.get(row.original.departmentId ?? '');
        const color = dept ? (semanticDeptColor(dept.name) ?? dept.color) : 'var(--k-primary)';
        return (
          <div className="k-person">
            <div className="k-person-avatar" style={{ background: color }}>
              {row.original.initials}
            </div>
            <div className="k-person-meta">
              <p className="k-person-name">{row.getValue('name')}</p>
              <p className="k-person-email">{row.original.email}</p>
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
        const color = dept ? (semanticDeptColor(dept.name) ?? dept.color) : 'var(--k-primary)';
        return (
          <span className="k-badge k-badge-no-dot"
                style={{ background: `${color}20`, color }}>
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
      cell: ({ row }) => {
        const total = row.original.assignedTrainings || 1;
        const done = Number(row.getValue('completedTrainings')) || 0;
        const pct = Math.min(100, Math.round((done / total) * 100));
        const variant = pct > 80 ? 'success' : pct > 50 ? undefined : 'warning';
        return (
          <div className="flex items-center gap-2">
            <div className="k-progress flex-1">
              <div className="k-progress-fill" style={{ width: `${pct}%` }} data-variant={variant} />
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
      cell: ({ row }) => {
        const score = row.getValue('avgScore') as number;
        const color = score >= 80 ? 'var(--k-success)' : score >= 60 ? 'var(--k-warning)' : 'var(--k-error)';
        return <span className="text-sm font-mono font-bold" style={{ color }}>{score}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      size: 90,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const s = status.toLocaleLowerCase('tr-TR');
        let bg = K.SURFACE_HOVER, fg = K.TEXT_MUTED;
        if (s.includes('aktif') && !s.includes('pas') && !s.includes('in')) {
          bg = K.PRIMARY_LIGHT; fg = K.PRIMARY;
        } else if (s.includes('beklemede') || s.includes('pending') || s.includes('davet')) {
          bg = K.WARNING_BG; fg = '#92400e';
        } else if (s.includes('pasif') || s.includes('locked') || s.includes('kilit') || s.includes('inactive')) {
          bg = K.ERROR_BG; fg = K.ERROR_TEXT;
        }
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 999,
              background: bg,
              color: fg,
              fontFamily: K.FONT_DISPLAY,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => <StaffActions staff={row.original} onChanged={refetch} />,
    },
  ], [departmentMap, refetch]);

  if (isLoading) {
    return <PageLoading />;
  }

  const statsData = data?.stats ?? { totalStaff: 0, activeStaff: 0, departmentCount: 0, avgScore: 0 };
  const filteredStaff = allStaff;
  const selectedDeptData = selectedDept ? departmentMap.get(selectedDept) : null;
  const selectedDeptColor = selectedDeptData
    ? (semanticDeptColor(selectedDeptData.name) ?? selectedDeptData.color)
    : 'var(--k-primary)';

  return (
    <div className="k-page">
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
          <button onClick={() => setShowBulkImport(true)} className="k-btn k-btn-ghost">
            <Upload size={15} /> Toplu Yükle
          </button>
          <button onClick={() => setShowAddStaff(true)} className="k-btn k-btn-primary">
            <Plus size={15} /> Yeni Personel
          </button>
        </div>
      </header>

      {/* KPIs */}
      <section className="k-kpi-grid" aria-label="Personel istatistikleri">
        <Kpi icon={<Users size={18} />} label="Toplam Personel" value={statsData.totalStaff} />
        <Kpi icon={<Users size={18} />} label="Aktif" value={statsData.activeStaff} />
        <Kpi icon={<Building2 size={18} />} label="Departman" value={statsData.departmentCount} />
        <Kpi icon={<Award size={18} />} label="Ort. Başarı" value={statsData.avgScore} suffix="%" />
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
                onClick={() => { setActiveView(v.key); setSelectedDept(null); setCurrentPage(1); setSearchQuery(''); }}
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
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {allDepartments.map(dept => {
            const deptColor = semanticDeptColor(dept.name) ?? dept.color;
            return (
            <article
              key={dept.id}
              onClick={() => { setSelectedDept(dept.id); setCurrentPage(1); setSearchQuery(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDept(dept.id); setCurrentPage(1); setSearchQuery(''); } }}
              role="button"
              tabIndex={0}
              className="k-card group relative cursor-pointer p-5 transition-all hover:-translate-y-0.5"
              style={{ borderLeft: `3px solid ${deptColor}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${deptColor}1f`, color: deptColor }}
                >
                  <Building2 size={16} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--k-surface-hover)] transition-opacity"
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
                      onClick={(e) => { e.stopPropagation(); setEditingDept({ id: dept.id, name: dept.name, color: dept.color }); }}
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
                    <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
                    <DropdownMenuItem
                      className="gap-2"
                      style={{ borderRadius: 8, color: K.ERROR, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}
                      disabled={deletingDeptId === dept.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (deletingDeptId) return;
                        if (!confirm('Bu departmanı silmek istediğinize emin misiniz? (İçindeki personeller boşa düşecektir)')) return;
                        setDeletingDeptId(dept.id);
                        try {
                          const res = await fetch(`/api/admin/departments/${dept.id}`, { method: 'DELETE' });
                          const resData = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(resData.error || 'Departman silinemedi');
                          toast('Departman silindi', 'success');
                          if (selectedDept === dept.id) setSelectedDept(null);
                          refetch();
                        } catch (err) {
                          toast(err instanceof Error ? err.message : 'Departman silinemedi', 'error');
                        } finally {
                          setDeletingDeptId(null);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> {deletingDeptId === dept.id ? 'Siliniyor...' : 'Departmanı Sil'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>
                {dept.name}
              </h3>
              {dept.description && (
                <p className="text-xs line-clamp-2 mb-4" style={{ color: 'var(--k-text-muted)' }}>
                  {dept.description}
                </p>
              )}

              <div className="flex items-center gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--k-border)' }}>
                <div className="flex">
                  {(staffByDeptMap.get(dept.id) ?? []).slice(0, 3).map(s => (
                    <Avatar key={s.id} className="h-6 w-6 -ml-1.5 first:ml-0 ring-2 ring-white">
                      <AvatarFallback className="text-[9px] font-semibold text-white" style={{ background: deptColor }}>
                        {s.initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {dept.staffCount > 3 && (
                    <div className="h-6 w-6 rounded-full -ml-1.5 ring-2 ring-white flex items-center justify-center text-[9px] font-bold"
                         style={{ background: 'var(--k-surface-hover)', color: 'var(--k-text-muted)' }}>
                      +{dept.staffCount - 3}
                    </div>
                  )}
                </div>
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
              className="flex flex-col items-center justify-center gap-2.5 min-h-[180px] p-7 rounded-2xl border-2 border-dashed transition-all hover:-translate-y-0.5"
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
                <button onClick={() => setShowAddDept(false)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[var(--k-surface-hover)]" aria-label="Kapat">
                  <X size={14} style={{ color: 'var(--k-text-muted)' }} />
                </button>
              </div>
              <Field label="Departman Adı">
                <Input
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
                        aria-label={`Renk: ${c}`}
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
                    const res = await fetch('/api/admin/departments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newDeptName.trim(), color: newDeptColor }),
                    });
                    const resData = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(resData.error || 'Departman oluşturulamadı');
                    toast(`"${newDeptName.trim()}" departmanı oluşturuldu`, 'success');
                    setShowAddDept(false);
                    setNewDeptName('');
                    refetch();
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
          <header className="k-card flex flex-wrap items-center gap-5 p-5" style={{ borderLeft: `3px solid ${selectedDeptColor}` }}>
            <button
              onClick={() => { setSelectedDept(null); setCurrentPage(1); setSearchQuery(''); }}
              className="k-btn k-btn-subtle k-btn-sm"
              aria-label="Departmanlara dön"
            >
              <ChevronRight size={14} className="rotate-180" /> Tüm Departmanlar
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: `${selectedDeptColor}20`, color: selectedDeptColor }}>
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
              <button className="k-btn k-btn-ghost" onClick={() => setEditingDept({ id: selectedDeptData.id, name: selectedDeptData.name, color: selectedDeptData.color })}>
                <Edit size={15} /> Düzenle
              </button>
              <button
                className="k-btn k-btn-ghost"
                style={{ color: 'var(--k-error)', borderColor: 'var(--k-error-bg)' }}
                disabled={deletingDeptId === selectedDept}
                onClick={async () => {
                  if (deletingDeptId) return;
                  if (!confirm(`"${selectedDeptData.name}" departmanını silmek istediğinize emin misiniz?`)) return;
                  setDeletingDeptId(selectedDept);
                  try {
                    const res = await fetch(`/api/admin/departments/${selectedDept}`, { method: 'DELETE' });
                    const resData = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(resData.error || 'Departman silinemedi');
                    toast('Departman silindi', 'success');
                    setSelectedDept(null);
                    refetch();
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Departman silinemedi', 'error');
                  } finally {
                    setDeletingDeptId(null);
                  }
                }}
              >
                <Trash2 size={15} /> {deletingDeptId === selectedDept ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </header>

          <div className="k-card p-5">
            <DataTable
              columns={columns}
              data={filteredStaff}
              searchKey="name"
              searchPlaceholder="Bu departmanda ara..."
              onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)}
              totalCount={data?.total}
              pageCount={data?.totalPages}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onSearchChange={handleSearch}
            />
          </div>
        </section>
      )}

      {/* All staff view */}
      {activeView === 'all' && (
        <div className="k-card p-5">
          <DataTable
            columns={columns}
            data={allStaff}
            searchKey="name"
            searchPlaceholder="Personel ara (isim, e-posta)..."
            onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)}
            totalCount={data?.total}
            pageCount={data?.totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onSearchChange={handleSearch}
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
                        body: JSON.stringify({ name: editingDept.name, color: editingDept.color }),
                      });
                      if (!res.ok) throw new Error('Güncellenemedi');
                      toast('Departman güncellendi', 'success');
                      setEditingDept(null);
                      refetch();
                    } catch {
                      toast('Departman güncellenemedi', 'error');
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
                      aria-label={`Renk: ${c}`}
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

      {showAddStaff && <NewStaffModal onClose={() => setShowAddStaff(false)} departments={allDepartments} onSaved={refetch} />}
      {showAssignStaff && selectedDept && (() => {
        const dept = departmentMap.get(selectedDept);
        return dept ? (
          <AssignStaffModal
            deptId={selectedDept}
            deptName={dept.name}
            allStaff={allStaff}
            onClose={() => setShowAssignStaff(false)}
            onSaved={refetch}
          />
        ) : null;
      })()}
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImported={refetch}
      />
    </div>
  );
}
