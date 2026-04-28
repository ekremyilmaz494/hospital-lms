'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Users, Plus, Upload, MoreHorizontal, Eye, Edit, GraduationCap, Mail,
  Building2, Trash2, UserPlus, ChevronRight, Search, X, Save, History, Award,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/data-table';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import dynamic from 'next/dynamic';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

const AssignTrainingModal = dynamic(
  () => import('./assign-training-modal').then(m => ({ default: m.AssignTrainingModal })),
  { ssr: false }
);
const BulkImportDialog = dynamic(
  () => import('./bulk-import-dialog').then(m => ({ default: m.BulkImportDialog })),
  { ssr: false }
);

// ── Klinova palette ──
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2', ERROR_TEXT: '#b91c1c',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

// ── Types ──
interface Staff {
  id: string;
  name: string;
  email: string;
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

// Prototip semantic department palette (klinova-admin/styles.css:825-839)
// Key → ana renk. Custom departmanlar için palette fallback kullanılır.
const DEPT_SEMANTIC: Record<string, string> = {
  acil: '#dc2626',
  cerrahi: '#7c3aed',
  pediatri: '#f59e0b',
  kardio: '#e11d48',
  noroloji: '#0284c7',
  onkoloji: '#0d9668',
  radyo: '#64748b',
  labor: '#0891b2',
};

const DEPARTMENT_COLORS = [
  '#0d9668', '#dc2626', '#7c3aed', '#e11d48', '#0284c7', '#f59e0b',
  '#0891b2', '#64748b', '#d97706', '#ec4899', '#14b8a6', '#f97316',
];

// Türkçe departman adını semantic key'e çevirir. Bulursa renk döner, yoksa null.
function semanticDeptColor(name: string): string | null {
  const n = name
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıi̇]/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  if (n.includes('acil')) return DEPT_SEMANTIC.acil;
  if (n.includes('cerrah')) return DEPT_SEMANTIC.cerrahi;
  if (n.includes('cocuk') || n.includes('pediatri')) return DEPT_SEMANTIC.pediatri;
  if (n.includes('kardi') || n.includes('kalp')) return DEPT_SEMANTIC.kardio;
  if (n.includes('norol') || n.includes('beyin') || n.includes('sinir')) return DEPT_SEMANTIC.noroloji;
  if (n.includes('onkol') || n.includes('kanser')) return DEPT_SEMANTIC.onkoloji;
  if (n.includes('radyol') || n.includes('goruntul')) return DEPT_SEMANTIC.radyo;
  if (n.includes('labor') || n.includes('laborat') || n.includes('tahlil')) return DEPT_SEMANTIC.labor;
  return null;
}

// ── Staff Actions Dropdown ──
function StaffActions({ staff, onChanged }: { staff: Staff; onChanged: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [assignTrainingOpen, setAssignTrainingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (purge: boolean) => {
    setDeleting(true);
    try {
      const url = `/api/admin/staff/${staff.id}${purge ? '?purge=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Silme başarısız');
      toast(purge ? `${staff.name} kalıcı olarak silindi` : `${staff.name} pasifleştirildi`, 'success');
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors duration-150 hover:bg-[var(--k-surface-hover)]" aria-label="Personel işlemleri">
          <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--k-text-muted)' }} />
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
            onClick={() => router.push(`/admin/staff/${staff.id}`)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Eye className="h-4 w-4" /> Detay
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => router.push(`/admin/staff/${staff.id}/edit`)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Edit className="h-4 w-4" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setAssignTrainingOpen(true)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <GraduationCap className="h-4 w-4" /> Eğitim Ata
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => { window.location.href = `mailto:${staff.email}`; }}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Mail className="h-4 w-4" /> E-posta Gönder
          </DropdownMenuItem>
          <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setConfirmDelete(true)}
            style={{ borderRadius: 8, color: K.ERROR, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}
          >
            <Trash2 className="h-4 w-4" /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignTrainingModal
        staffId={staff.id}
        staffName={staff.name}
        open={assignTrainingOpen}
        onOpenChange={setAssignTrainingOpen}
      />

      <PremiumModal
        isOpen={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        eyebrow="Tehlikeli İşlem"
        title="Personeli sil"
        subtitle={`${staff.name} (${staff.email}) için bir seçim yap.`}
        size="md"
        disableEscape={deleting}
        footer={
          <PremiumModalFooter
            actions={
              <PremiumButton variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Vazgeç
              </PremiumButton>
            }
          />
        }
      >
        <div className="grid gap-3">
          <button
            onClick={() => handleDelete(false)}
            disabled={deleting}
            className="text-left rounded-xl border p-5 transition-all hover:-translate-y-px disabled:opacity-50"
            style={{ borderColor: 'var(--k-border)', background: 'var(--k-surface)' }}
          >
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}>
              Önerilen
            </span>
            <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>Pasifleştir</h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              Personel giriş yapamaz; geçmiş sınav ve sertifika kayıtları korunur. Daha sonra yeniden aktifleştirilebilir.
            </p>
          </button>

          <button
            onClick={() => handleDelete(true)}
            disabled={deleting}
            className="text-left rounded-xl border p-5 transition-all hover:-translate-y-px disabled:opacity-50"
            style={{ borderColor: 'var(--k-error)', background: 'var(--k-error-bg)' }}
          >
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ background: 'var(--k-error)', color: '#fff' }}>
              KVKK · Geri alınamaz
            </span>
            <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--k-error)' }}>Kalıcı olarak sil</h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              Kullanıcı hesabı ve kişisel veriler tamamen kaldırılır. Bu işlem geri alınamaz.
            </p>
          </button>
        </div>
      </PremiumModal>
    </>
  );
}

// ── New Staff Modal ──
function NewStaffModal({ onClose, departments, onSaved }: { onClose: () => void; departments: Department[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', telefon: '', departman: '', unvan: '' });
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
    if (form.sifre.trim() && form.sifre.length < 8) e.sifre = 'Şifre en az 8 karakter olmalıdır';
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
          phone: form.telefon || undefined,
          departmentId: form.departman || undefined,
          title: form.unvan || undefined,
          password: form.sifre.trim() || undefined,
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
    background: 'var(--k-surface)',
    borderColor: errors[field] ? 'var(--k-error)' : 'var(--k-border)',
  });

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Personel Kaydı"
      title="Yeni personel ekle"
      subtitle="Hesabı oluşturur ve giriş bilgilerini e-posta ile iletir."
      size="lg"
      disableEscape={saving}
      footer={
        !saved ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--k-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Kaydediliyor' : 'Personel Ekle'}
                </PremiumButton>
              </>
            }
          />
        ) : null
      }
    >
      {saved ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: 'var(--k-primary)', color: '#fff' }}>
            <UserPlus className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-semibold" style={{ color: 'var(--k-text-primary)' }}>
            Personel başarıyla eklendi
          </h4>
          <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
            Giriş bilgileri {form.email} adresine gönderildi.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad *" error={errors.ad}>
              <Input placeholder="Personel adı" className="h-10" value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))} style={fieldStyle('ad')} />
            </Field>
            <Field label="Soyad *" error={errors.soyad}>
              <Input placeholder="Personel soyadı" className="h-10" value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))} style={fieldStyle('soyad')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-posta *" error={errors.email}>
              <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle('email')} />
            </Field>
            <Field label="Şifre" error={errors.sifre} hint={!errors.sifre ? 'Boş bırakın — otomatik üretilip e-posta ile iletilir.' : undefined}>
              <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))} style={fieldStyle('sifre')} />
            </Field>
          </div>
          <Field label="Telefon" error={errors.telefon}>
            <Input placeholder="05XX XXX XX XX" className="h-10"
                   value={form.telefon}
                   onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                   style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Departman *" error={errors.departman}>
              <select
                className="h-10 w-full rounded-lg border px-3 text-sm"
                style={fieldStyle('departman')}
                value={form.departman}
                onChange={(e) => setForm(f => ({ ...f, departman: e.target.value }))}
              >
                <option value="">Seçin...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Unvan">
              <Input placeholder="örn. Hemşire" className="h-10" value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))} style={fieldStyle('unvan')} />
            </Field>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
             style={{ color: 'var(--k-text-muted)' }}>{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--k-error)' }}>{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[11px] italic" style={{ color: 'var(--k-text-muted)' }}>{hint}</p>}
    </div>
  );
}

// ── Assign Existing Staff to Department Modal ──
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
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all([...selected].map(id =>
        fetch(`/api/admin/staff/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId: deptId }),
        })
      ));
      const failed = results.filter(r => !r.ok).length;
      const succeeded = results.length - failed;
      if (succeeded > 0) toast(`${succeeded} personel departmana eklendi`, 'success');
      if (failed > 0) toast(`${failed} personel eklenemedi`, 'error');
      if (succeeded > 0) {
        onSaved();
        onClose();
      }
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Departman Ataması"
      title="Personel ekle"
      subtitle={`${deptName} departmanına personel ata.`}
      size="md"
      disableEscape={saving}
      footer={
        <PremiumModalFooter
          summary={
            <span className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              {selected.size > 0 ? (
                <><strong style={{ color: 'var(--k-text-primary)' }}>{selected.size}</strong> personel seçildi</>
              ) : 'Personel seçin'}
            </span>
          }
          actions={
            <>
              <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
              <PremiumButton onClick={handleAssign} disabled={selected.size === 0} loading={saving} icon={<UserPlus className="h-4 w-4" />}>
                {saving ? 'Ekleniyor' : 'Ekle'}
              </PremiumButton>
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="k-input" style={{ height: 42 }}>
          <Search size={15} />
          <input
            placeholder="İsim veya e-posta ile ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Personel ara"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--k-text-muted)' }}>
              <Users className="h-7 w-7" />
              <p className="text-sm">{search ? 'Sonuç bulunamadı' : 'Eklenebilecek personel yok'}</p>
            </div>
          ) : available.map(s => {
            const isSelected = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left"
                style={{
                  borderColor: isSelected ? 'var(--k-primary)' : 'var(--k-border)',
                  background: isSelected ? 'var(--k-primary-light)' : 'var(--k-surface)',
                }}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--k-primary)' }}>{s.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--k-text-primary)' }}>{s.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--k-text-muted)' }}>
                    {s.email}{s.department ? ` · ${s.department}` : ' · Departmansız'}
                  </p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                     style={{
                       borderColor: isSelected ? 'var(--k-primary)' : 'var(--k-border-hover)',
                       background: isSelected ? 'var(--k-primary)' : 'transparent',
                       color: '#fff',
                       fontSize: 11,
                     }}>
                  {isSelected && '✓'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PremiumModal>
  );
}

// ── Main Page ──
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

// ── KPI card ──
function Kpi({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <div className="k-kpi">
      <div className="k-kpi-top">
        <div>
          <div className="k-kpi-label">{label}</div>
          <div className="k-kpi-value">
            {value.toLocaleString('tr-TR')}
            {suffix && <span className="text-base font-medium ml-1" style={{ color: 'var(--k-text-muted)' }}>{suffix}</span>}
          </div>
        </div>
        <div className="k-kpi-icon">{icon}</div>
      </div>
    </div>
  );
}
