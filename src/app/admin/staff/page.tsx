'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Users, Plus, Upload, MoreHorizontal, Eye, Edit, GraduationCap, Mail,
  Building2, Trash2, UserPlus, ChevronRight, Search, X, Save
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

// ── Types ──
interface Staff {
  id: string;
  name: string;
  email: string;
  tcNo: string;
  department: string;
  departmentId: string | null;
  title: string;
  assignedTrainings: number;
  completedTrainings: number;
  avgScore: number;
  status: string;
  initials: string;
}

interface Department {
  id: string;
  name: string;
  color: string;
  description: string;
  staffCount: number;
}

interface StaffPageData {
  staff: Staff[];
  departments: Department[];
  stats: { totalStaff: number; activeStaff: number; departmentCount: number; avgScore: number };
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEPARTMENT_COLORS = [
  '#0d9668', '#dc2626', '#2563eb', '#059669', '#f59e0b', '#d97706', '#6366f1', '#ec4899',
  '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4',
];

const statusColors: Record<string, { bg: string; text: string }> = {
  'Aktif': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Pasif': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

// ── Staff Actions Component ──
function StaffActions({ staff }: { staff: Staff }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-lg transition-colors duration-150 hover:bg-(--color-surface-hover)">
        <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/staff/${staff.id}`)}>
          <Eye className="h-4 w-4" /> Detay
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/staff/${staff.id}/edit`)}>
          <Edit className="h-4 w-4" /> Düzenle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => router.push(`/admin/trainings/new?staffId=${staff.id}`)}>
          <GraduationCap className="h-4 w-4" /> Eğitim Ata
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => window.location.href = `mailto:${staff.email}`}>
          <Mail className="h-4 w-4" /> E-posta Gönder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── New Staff Modal ──
function NewStaffModal({ onClose, departments, onSaved }: { onClose: () => void; departments: Department[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', tc: '', telefon: '', departman: '', unvan: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ad.trim()) e.ad = 'Ad zorunludur';
    if (!form.soyad.trim()) e.soyad = 'Soyad zorunludur';
    if (!form.email.trim()) e.email = 'E-posta zorunludur';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Geçerli bir e-posta girin';
    if (!form.sifre.trim()) e.sifre = 'Şifre zorunludur';
    else if (form.sifre.length < 8) e.sifre = 'Şifre en az 8 karakter olmalıdır';
    if (form.tc && !/^\d{11}$/.test(form.tc)) e.tc = 'TC Kimlik No 11 haneli olmalıdır';
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';
    if (!form.departman) e.departman = 'Departman seçiniz';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.ad,
          lastName: form.soyad,
          email: form.email,
          tcNo: form.tc || undefined,
          phone: form.telefon || undefined,
          departmentId: form.departman || undefined,
          title: form.unvan || undefined,
          password: form.sifre,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      closeTimerRef.current = setTimeout(() => { onSaved(); onClose(); }, 1500);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = (field: string) => ({
    background: 'var(--color-bg)',
    borderColor: errors[field] ? 'var(--color-error)' : 'var(--color-border)',
  });

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 space-y-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Yeni Personel Ekle</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Personel bilgilerini girin</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-(--color-surface-hover)">
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--color-success-bg)' }}>
              <UserPlus className="h-6 w-6" style={{ color: 'var(--color-success)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>Personel başarıyla eklendi!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Ad *</Label>
                <Input placeholder="Personel adı" className="h-10" value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))} style={fieldStyle('ad')} />
                {errors.ad && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.ad}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Soyad *</Label>
                <Input placeholder="Personel soyadı" className="h-10" value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))} style={fieldStyle('soyad')} />
                {errors.soyad && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.soyad}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>E-posta *</Label>
                <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle('email')} />
                {errors.email && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.email}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Şifre *</Label>
                <Input type="password" placeholder="En az 8 karakter" className="h-10" value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))} style={fieldStyle('sifre')} />
                {errors.sifre && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.sifre}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>TC Kimlik No</Label>
                <Input placeholder="11 haneli TC No" maxLength={11} className="h-10" value={form.tc} onChange={(e) => setForm(f => ({ ...f, tc: e.target.value.replace(/\D/g, '').slice(0, 11) }))} style={{ ...fieldStyle('tc'), fontFamily: 'var(--font-mono)' }} />
                {errors.tc && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.tc}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                <Input placeholder="05XX XXX XX XX" className="h-10" value={form.telefon} onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))} style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
                {errors.telefon && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.telefon}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Departman *</Label>
                <select
                  className="w-full rounded-lg border px-3 py-2.5 text-sm h-10"
                  style={{ ...fieldStyle('departman'), color: 'var(--color-text-primary)' }}
                  value={form.departman}
                  onChange={(e) => setForm(f => ({ ...f, departman: e.target.value }))}
                >
                  <option value="">Seçin...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.departman && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.departman}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Unvan</Label>
                <Input placeholder="örn. Hemşire" className="h-10" value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))} style={fieldStyle('unvan')} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-lg" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                İptal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 rounded-lg font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                {saving ? 'Kaydediliyor...' : 'Personel Ekle'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Assign Existing Staff Modal ──
function AssignStaffModal({ deptId, deptName, allStaff, onClose, onSaved }: {
  deptId: string; deptName: string; allStaff: Staff[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const available = allStaff.filter(s =>
    s.departmentId !== deptId &&
    (search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/admin/staff/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId: deptId }),
        })
      ));
      toast(`${selected.size} personel departmana eklendi`, 'success');
      onSaved();
      onClose();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Personel Ekle</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{deptName} departmanına personel ata</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-(--color-surface-hover)">
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            className="w-full h-10 rounded-xl border pl-9 pr-4 text-sm outline-none"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            placeholder="İsim veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-1.5 min-h-0" style={{ maxHeight: '340px' }}>
          {available.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Users className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {search ? 'Sonuç bulunamadı' : 'Eklenebilecek personel yok'}
              </p>
            </div>
          ) : available.map(s => {
            const isSelected = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150"
                style={{
                  background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                  border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }}>{s.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {s.email}{s.department ? ` · ${s.department}` : ' · Departmansız'}
                  </p>
                </div>
                <div
                  className="h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                  }}
                >
                  {isSelected && <span className="text-[10px] text-white font-bold">✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {selected.size > 0 ? `${selected.size} personel seçildi` : 'Personel seçin'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-lg" style={{ borderColor: 'var(--color-border)' }}>İptal</Button>
            <Button
              onClick={handleAssign}
              disabled={selected.size === 0 || saving}
              className="gap-2 rounded-lg font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <UserPlus className="h-4 w-4" />}
              {saving ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function StaffPage() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading, refetch } = useFetch<StaffPageData>(`/api/admin/staff?page=${currentPage}&limit=20`);
  const [activeView, setActiveView] = useState<'all' | 'departments'>('departments');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState(DEPARTMENT_COLORS[0]);
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editDeptSaving, setEditDeptSaving] = useState(false);

  if (isLoading) {
    return <PageLoading />;
  }

  // API hatası olsa bile sayfayı boş veri ile render et (backend henüz yapılandırılmamış olabilir)

  const allStaff = data?.staff ?? [];
  const allDepartments = data?.departments ?? [];
  const statsData = data?.stats ?? { totalStaff: 0, activeStaff: 0, departmentCount: 0, avgScore: 0 };

  const filteredStaff = selectedDept
    ? allStaff.filter(s => s.departmentId === selectedDept)
    : allStaff;

  const selectedDeptData = selectedDept ? allDepartments.find(d => d.id === selectedDept) : null;

  // ── Columns ──
  const columns: ColumnDef<Staff>[] = [
    {
      accessorKey: 'name',
      header: 'Personel',
      cell: ({ row }) => {
        const dept = allDepartments.find(d => d.id === row.original.departmentId);
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ background: dept?.color || 'var(--color-primary)' }}>{row.original.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{row.getValue('name')}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.original.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Departman',
      cell: ({ row }) => {
        const dept = allDepartments.find(d => d.id === row.original.departmentId);
        const color = dept?.color || 'var(--color-primary)';
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${color}15`, color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {row.getValue('department')}
          </span>
        );
      },
    },
    { accessorKey: 'title', header: 'Unvan', cell: ({ row }) => <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{row.getValue('title')}</span> },
    {
      accessorKey: 'completedTrainings',
      header: 'Eğitim',
      cell: ({ row }) => (
        <span className="text-sm font-mono font-medium">{row.getValue('completedTrainings')}/{row.original.assignedTrainings}</span>
      ),
    },
    {
      accessorKey: 'avgScore',
      header: 'Ort. Puan',
      cell: ({ row }) => {
        const score = row.getValue('avgScore') as number;
        const color = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
        return <span className="text-sm font-mono font-bold" style={{ color }}>{score}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const colors = statusColors[status] || statusColors['Aktif'];
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.text }} />
            {status}
          </span>
        );
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <StaffActions staff={row.original} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personel Yönetimi"
        subtitle="Departmanları ve personelleri görüntüle, yönet"
        action={{ label: 'Yeni Personel', icon: Plus, onClick: () => setShowAddStaff(true) }}
        secondaryAction={{ label: 'Excel', icon: Upload, onClick: () => document.getElementById('excel-import')?.click() }}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Toplam Personel" value={statsData.totalStaff} icon={Users} accentColor="var(--color-info)" />
        <StatCard title="Aktif" value={statsData.activeStaff} icon={Users} accentColor="var(--color-success)" />
        <StatCard title="Departman" value={statsData.departmentCount} icon={Building2} accentColor="var(--color-primary)" />
        <StatCard title="Ort. Başarı" value={`${statsData.avgScore}%`} icon={GraduationCap} accentColor="var(--color-accent)" />
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl p-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {[
            { key: 'departments' as const, label: 'Departmanlara Göre', icon: Building2 },
            { key: 'all' as const, label: 'Tüm Personel', icon: Users },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => { setActiveView(v.key); setSelectedDept(null); }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150"
              style={{
                background: activeView === v.key ? 'var(--color-primary)' : 'transparent',
                color: activeView === v.key ? 'white' : 'var(--color-text-muted)',
              }}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Department View */}
      {activeView === 'departments' && !selectedDept && (
        <BlurFade delay={0.05}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allDepartments.map((dept, i) => (
                <BlurFade key={dept.id} delay={0.05 + i * 0.03}>
                  <div
                    onClick={() => setSelectedDept(dept.id)}
                    className="group w-full text-left rounded-2xl border p-5 cursor-pointer transition-transform duration-200 hover:-translate-y-1"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 25px ${dept.color}20`; e.currentTarget.style.borderColor = `${dept.color}40`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDept(dept.id); } }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${dept.color}15` }}>
                        <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-(--color-surface-hover)"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); setEditingDept({ id: dept.id, name: dept.name, color: dept.color }); }}><Edit className="h-4 w-4" /> Düzenle</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); setSelectedDept(dept.id); setShowAssignStaff(true); }}><UserPlus className="h-4 w-4" /> Personel Ekle</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-red-500"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Bu departmanı silmek istediğinize emin misiniz? (İçindeki personeller boşa düşecektir)')) {
                                try {
                                  const res = await fetch(`/api/admin/departments/${dept.id}`, { method: 'DELETE' });
                                  if (!res.ok) throw new Error('Silinemedi');
                                  toast('Departman silindi', 'success');
                                  if (selectedDept === dept.id) setSelectedDept(null);
                                  refetch();
                                } catch (_err) {
                                  toast('Departman silinemedi', 'error');
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Departmanı Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h3 className="text-base font-bold mb-1">{dept.name}</h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{dept.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {allStaff
                            .filter(s => s.departmentId === dept.id)
                            .slice(0, 3)
                            .map((s) => (
                              <Avatar key={s.id} className="h-7 w-7 border-2" style={{ borderColor: 'var(--color-surface)' }}>
                                <AvatarFallback className="text-[9px] font-semibold text-white" style={{ background: dept.color }}>{s.initials}</AvatarFallback>
                              </Avatar>
                            ))}
                          {dept.staffCount > 3 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-bold" style={{ borderColor: 'var(--color-surface)', background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
                              +{dept.staffCount - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                          {dept.staffCount} kişi
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  </div>
                </BlurFade>
              ))}

              {/* Add Department Card */}
              <BlurFade delay={0.05 + allDepartments.length * 0.03}>
                {!showAddDept ? (
                  <button
                    onClick={() => setShowAddDept(true)}
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors duration-200 hover:border-solid"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--color-surface-hover)' }}>
                      <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-semibold">Yeni Departman</span>
                  </button>
                ) : (
                  <div
                    className="rounded-2xl border p-5 space-y-4"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-primary)', boxShadow: 'var(--shadow-md)' }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">Yeni Departman</h4>
                      <button onClick={() => setShowAddDept(false)} className="rounded-md p-1 hover:bg-(--color-surface-hover)">
                        <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Departman Adı</label>
                      <Input
                        placeholder="Örn: Kardiyoloji"
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        className="h-10"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Renk</label>
                      <div className="flex flex-wrap gap-2">
                        {DEPARTMENT_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewDeptColor(c)}
                            className="h-7 w-7 rounded-full transition-transform duration-150 hover:scale-110"
                            style={{
                              background: c,
                              outline: newDeptColor === c ? `2px solid ${c}` : 'none',
                              outlineOffset: '2px',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full gap-2 rounded-xl font-semibold text-white"
                      style={{ background: newDeptColor }}
                      disabled={!newDeptName.trim() || isSavingDept}
                      onClick={async () => {
                        setIsSavingDept(true);
                        try {
                          const res = await fetch('/api/admin/departments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newDeptName, color: newDeptColor }),
                          });
                          if (!res.ok) throw new Error('Departman oluşturulamadı');
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
                      {isSavingDept ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Plus className="h-4 w-4" />}
                      {isSavingDept ? 'Oluşturuluyor...' : 'Departman Oluştur'}
                    </Button>
                  </div>
                )}
              </BlurFade>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Selected Department Detail */}
      {activeView === 'departments' && selectedDept && selectedDeptData && (
        <BlurFade delay={0.05}>
          <div className="space-y-4">
            <div
              className="flex items-center justify-between rounded-2xl border p-5"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedDept(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150"
                  style={{ background: 'var(--color-surface-hover)' }}
                >
                  <ChevronRight className="h-5 w-5 rotate-180" style={{ color: 'var(--color-text-secondary)' }} />
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${selectedDeptData.color}15` }}>
                  <Building2 className="h-6 w-6" style={{ color: selectedDeptData.color }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedDeptData.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{filteredStaff.length} personel</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)' }} onClick={() => setShowAssignStaff(true)}>
                  <UserPlus className="h-4 w-4" /> Personel Ekle
                </Button>
                <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)' }} onClick={() => setEditingDept({ id: selectedDeptData.id, name: selectedDeptData.name, color: selectedDeptData.color })}>
                  <Edit className="h-4 w-4" /> Düzenle
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl text-red-500"
                  style={{ borderColor: 'var(--color-error)' }}
                  onClick={async () => {
                    if (confirm(`"${selectedDeptData.name}" departmanını silmek istediğinize emin misiniz?`)) {
                      try {
                        const res = await fetch(`/api/admin/departments/${selectedDept}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Silinemedi');
                        toast('Departman silindi', 'success');
                        setSelectedDept(null);
                        refetch();
                      } catch {
                        toast('Departman silinemedi', 'error');
                      }
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Sil
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <DataTable columns={columns} data={filteredStaff} searchKey="name" searchPlaceholder="Bu departmanda ara..." />
            </div>
          </div>
        </BlurFade>
      )}

      {/* All Staff View */}
      {activeView === 'all' && (
        <BlurFade delay={0.05}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <DataTable columns={columns} data={allStaff} searchKey="name" searchPlaceholder="Personel ara (isim, TC, e-posta)..." />
            <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Toplam {data?.total ?? allStaff.length} personel{(data?.totalPages ?? 1) > 1 ? ` — Sayfa ${currentPage}/${data?.totalPages}` : ''}
              </p>
              {(data?.totalPages ?? 1) > 1 && (
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="rounded-lg text-xs"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= (data?.totalPages ?? 1)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="rounded-lg text-xs"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Sonraki
                  </Button>
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      )}

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={() => setEditingDept(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Departman Düzenle</h3>
              <button onClick={() => setEditingDept(null)} className="rounded-lg p-2 hover:bg-(--color-surface-hover)">
                <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Departman Adı</Label>
              <Input
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="h-10"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Renk</Label>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditingDept({ ...editingDept, color: c })}
                    className="h-7 w-7 rounded-full transition-transform duration-150 hover:scale-110"
                    style={{ background: c, outline: editingDept.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditingDept(null)} className="rounded-lg" style={{ borderColor: 'var(--color-border)' }}>İptal</Button>
              <Button
                disabled={!editingDept.name.trim() || editDeptSaving}
                className="gap-2 rounded-lg font-semibold text-white"
                style={{ background: editingDept.color }}
                onClick={async () => {
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
                {editDeptSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                {editDeptSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddStaff && <NewStaffModal onClose={() => setShowAddStaff(false)} departments={allDepartments} onSaved={refetch} />}
      {showAssignStaff && selectedDept && (() => {
        const dept = allDepartments.find(d => d.id === selectedDept);
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
      <input
        id="excel-import"
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = '';
          toast(`"${file.name}" okunuyor...`, 'info');
          try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/bulk-import', { method: 'POST', body: formData });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Import başarısız');
            toast(`${result.created} personel eklendi${result.failed > 0 ? `, ${result.failed} başarısız` : ''}`, result.created > 0 ? 'success' : 'error');
            if (result.created > 0) refetch();
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Excel dosyası işlenemedi', 'error');
          }
        }}
      />
    </div>
  );
}
