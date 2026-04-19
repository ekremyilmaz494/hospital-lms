'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Users, Plus, Upload, MoreHorizontal, Eye, Edit, GraduationCap, Mail,
  Building2, Trash2, UserPlus, ChevronRight, Search, X, Save, History
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
import { AssignTrainingModal } from './assign-training-modal';
import { BulkImportDialog } from './bulk-import-dialog';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

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

const DEPARTMENT_COLORS = [
  'var(--brand-600)', '#dc2626', '#2563eb', 'var(--brand-600)', '#f59e0b', '#d97706', '#6366f1', '#ec4899',
  '#14b8a6', '#8b5cf6', '#f97316', '#06b6d4',
];

const statusColors: Record<string, { bg: string; text: string }> = {
  'Aktif': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Pasif': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

// ── Staff Actions Component ──
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
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-lg transition-colors duration-150 hover:bg-(--color-surface-hover)" aria-label="Personel işlemleri">
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
          <DropdownMenuItem className="gap-2" onClick={() => setAssignTrainingOpen(true)}>
            <GraduationCap className="h-4 w-4" /> Eğitim Ata
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => window.location.href = `mailto:${staff.email}`}>
            <Mail className="h-4 w-4" /> E-posta Gönder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-red-500"
            onClick={() => setConfirmDelete(true)}
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
        <div className="sdx-choices">
          <button
            onClick={() => handleDelete(false)}
            disabled={deleting}
            className="sdx-choice sdx-soft"
          >
            <div className="sdx-choice-head">
              <span className="sdx-badge sdx-badge-soft">Önerilen</span>
              <h4>Pasifleştir</h4>
            </div>
            <p>Personel giriş yapamaz, ancak geçmiş sınav ve sertifika kayıtları korunur. Daha sonra yeniden aktifleştirilebilir.</p>
          </button>

          <button
            onClick={() => handleDelete(true)}
            disabled={deleting}
            className="sdx-choice sdx-hard"
          >
            <div className="sdx-choice-head">
              <span className="sdx-badge sdx-badge-hard">KVKK · Geri alınamaz</span>
              <h4>Kalıcı olarak sil</h4>
            </div>
            <p>Kullanıcı hesabı ve kişisel veriler tamamen kaldırılır. Bu işlem geri alınamaz.</p>
          </button>
        </div>

        <style jsx>{`
          .sdx-choices { display: grid; gap: 12px; }
          .sdx-choice {
            text-align: left;
            padding: 18px 20px;
            border-radius: 14px;
            background: #ffffff;
            border: 1px solid #ebe7df;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6);
            cursor: pointer;
            transition: border-color 160ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1), background 160ms ease;
            font-family: inherit;
          }
          .sdx-choice:hover:not(:disabled) { transform: translateY(-1px); }
          .sdx-choice:disabled { opacity: 0.5; cursor: not-allowed; }
          .sdx-soft:hover:not(:disabled) { border-color: #0a0a0a; }
          .sdx-hard { border-color: #e9c9c0; background: #fdf5f2; }
          .sdx-hard:hover:not(:disabled) { border-color: #b3261e; background: #faeae4; }
          .sdx-choice-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
          .sdx-choice h4 {
            font-family: var(--font-editorial, serif);
            font-size: 18px;
            font-weight: 500;
            font-variation-settings: 'opsz' 36;
            color: #0a0a0a;
            margin: 0;
            letter-spacing: -0.01em;
          }
          .sdx-hard h4 { color: #7a1d14; }
          .sdx-choice p {
            font-size: 13px;
            line-height: 1.55;
            color: #6b6a63;
            margin: 0;
          }
          .sdx-badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .sdx-badge-soft { background: #f0ece1; color: #5c5a4e; }
          .sdx-badge-hard { background: #b3261e; color: #fff; }
        `}</style>
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
    // Şifre opsiyonel — boşsa backend üretir, doluysa en az 8 karakter
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
    background: 'var(--color-bg)',
    borderColor: errors[field] ? 'var(--color-error)' : 'var(--color-border)',
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
            summary={<span>Zorunlu alanlar <em style={{ fontStyle: 'italic', color: '#0a0a0a' }}>*</em> ile işaretli</span>}
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
        <div className="nsm-saved">
          <div className="nsm-saved-icon">
            <UserPlus className="h-6 w-6" />
          </div>
          <h4>Personel başarıyla eklendi</h4>
          <p>Giriş bilgileri {form.email} adresine gönderildi.</p>
        </div>
      ) : (
        <div className="nsm-form">
          <div className="nsm-row">
            <div className="nsm-field">
              <Label className="nsm-label">Ad *</Label>
              <Input placeholder="Personel adı" className="h-10" value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))} style={fieldStyle('ad')} />
              {errors.ad && <p className="nsm-err">{errors.ad}</p>}
            </div>
            <div className="nsm-field">
              <Label className="nsm-label">Soyad *</Label>
              <Input placeholder="Personel soyadı" className="h-10" value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))} style={fieldStyle('soyad')} />
              {errors.soyad && <p className="nsm-err">{errors.soyad}</p>}
            </div>
          </div>
          <div className="nsm-row">
            <div className="nsm-field">
              <Label className="nsm-label">E-posta *</Label>
              <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle('email')} />
              {errors.email && <p className="nsm-err">{errors.email}</p>}
            </div>
            <div className="nsm-field">
              <Label className="nsm-label">Şifre</Label>
              <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))} style={fieldStyle('sifre')} />
              {errors.sifre ? (
                <p className="nsm-err">{errors.sifre}</p>
              ) : (
                <p className="nsm-hint">Otomatik üretilip personelin e-postasına gönderilir.</p>
              )}
            </div>
          </div>
          <div className="nsm-field">
            <Label className="nsm-label">Telefon</Label>
            <Input placeholder="05XX XXX XX XX" className="h-10" value={form.telefon} onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))} style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            {errors.telefon && <p className="nsm-err">{errors.telefon}</p>}
          </div>
          <div className="nsm-row">
            <div className="nsm-field">
              <Label className="nsm-label">Departman *</Label>
              <select
                className="nsm-select"
                style={{ ...fieldStyle('departman') }}
                value={form.departman}
                onChange={(e) => setForm(f => ({ ...f, departman: e.target.value }))}
              >
                <option value="">Seçin...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.departman && <p className="nsm-err">{errors.departman}</p>}
            </div>
            <div className="nsm-field">
              <Label className="nsm-label">Unvan</Label>
              <Input placeholder="örn. Hemşire" className="h-10" value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))} style={fieldStyle('unvan')} />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .nsm-form { display: flex; flex-direction: column; gap: 18px; }
        .nsm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .nsm-row { grid-template-columns: 1fr; } }
        .nsm-field { display: flex; flex-direction: column; }
        :global(.nsm-label) {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #6b6a63;
          margin-bottom: 6px;
          display: block;
        }
        .nsm-err {
          font-size: 11px;
          color: #b3261e;
          margin-top: 6px;
          font-weight: 500;
        }
        .nsm-hint {
          font-size: 11px;
          color: #8a8578;
          margin-top: 6px;
          font-style: italic;
        }
        .nsm-select {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          border: 1px solid #ebe7df;
          background: #ffffff;
          padding: 0 12px;
          font-size: 14px;
          color: #0a0a0a;
          font-family: inherit;
        }
        .nsm-select:focus { outline: 2px solid #0a0a0a; outline-offset: 1px; }

        .nsm-saved {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px 20px;
          gap: 14px;
        }
        .nsm-saved-icon {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          color: #fafaf7;
        }
        .nsm-saved h4 {
          font-family: var(--font-editorial, serif);
          font-size: 22px;
          font-weight: 500;
          font-variation-settings: 'opsz' 42;
          color: #0a0a0a;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .nsm-saved p { font-size: 13px; color: #6b6a63; margin: 0; }
      `}</style>
    </PremiumModal>
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
            <span>
              {selected.size > 0
                ? <><strong style={{ color: '#0a0a0a' }}>{selected.size.toString().padStart(2, '0')}</strong> personel seçildi</>
                : 'Personel seç'}
            </span>
          }
          actions={
            <>
              <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
              <PremiumButton
                onClick={handleAssign}
                disabled={selected.size === 0}
                loading={saving}
                icon={<UserPlus className="h-4 w-4" />}
              >
                {saving ? 'Ekleniyor' : 'Ekle'}
              </PremiumButton>
            </>
          }
        />
      }
    >
      <div className="asm-root">
        <div className="asm-search">
          <Search className="asm-search-icon" />
          <input
            className="asm-search-input"
            placeholder="İsim veya e-posta ile ara..."
            aria-label="Personel ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="asm-list">
          {available.length === 0 ? (
            <div className="asm-empty">
              <Users className="h-7 w-7" />
              <p>{search ? 'Sonuç bulunamadı' : 'Eklenebilecek personel yok'}</p>
            </div>
          ) : available.map((s, i) => {
            const isSelected = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`asm-row ${isSelected ? 'asm-row-on' : ''}`}
                style={{ animationDelay: `${Math.min(i * 18, 240)}ms` }}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: '#0a0a0a' }}>{s.initials}</AvatarFallback>
                </Avatar>
                <div className="asm-row-body">
                  <p className="asm-row-name">{s.name}</p>
                  <p className="asm-row-meta">
                    {s.email}{s.department ? ` · ${s.department}` : ' · Departmansız'}
                  </p>
                </div>
                <div className={`asm-check ${isSelected ? 'asm-check-on' : ''}`}>
                  {isSelected && <span>✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .asm-root { display: flex; flex-direction: column; gap: 14px; }
        .asm-search {
          position: relative;
          display: flex;
          align-items: center;
        }
        :global(.asm-search-icon) {
          position: absolute;
          left: 14px;
          width: 16px;
          height: 16px;
          color: #8a8578;
          pointer-events: none;
        }
        .asm-search-input {
          width: 100%;
          height: 44px;
          padding: 0 14px 0 40px;
          border-radius: 10px;
          border: 1px solid #ebe7df;
          background: #ffffff;
          font-size: 14px;
          color: #0a0a0a;
          outline: none;
          font-family: inherit;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .asm-search-input:focus {
          border-color: #0a0a0a;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.06);
        }

        .asm-list {
          max-height: 340px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-right: 4px;
        }
        .asm-list::-webkit-scrollbar { width: 8px; }
        .asm-list::-webkit-scrollbar-track { background: transparent; }
        .asm-list::-webkit-scrollbar-thumb { background: #ebe7df; border-radius: 4px; }

        .asm-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          cursor: pointer;
          font-family: inherit;
          opacity: 0;
          animation: asm-in 320ms cubic-bezier(0.16,1,0.3,1) forwards;
          transition: border-color 160ms ease, background 160ms ease;
        }
        @keyframes asm-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .asm-row:hover { border-color: #c8c2b0; }
        .asm-row-on {
          background: #0a0a0a;
          border-color: #0a0a0a;
        }
        .asm-row-on .asm-row-name,
        .asm-row-on .asm-row-meta { color: #fafaf7; }
        .asm-row-on .asm-row-meta { opacity: 0.7; }

        .asm-row-body { flex: 1; min-width: 0; }
        .asm-row-name {
          font-size: 13px;
          font-weight: 600;
          color: #0a0a0a;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .asm-row-meta {
          font-size: 11px;
          color: #6b6a63;
          margin: 2px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .asm-check {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 1.5px solid #d9d4c4;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: #fafaf7;
          font-size: 11px;
          font-weight: 700;
          transition: background 160ms ease, border-color 160ms ease;
        }
        .asm-check-on {
          background: #fafaf7;
          border-color: #fafaf7;
          color: #0a0a0a;
        }

        .asm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 40px 20px;
          color: #8a8578;
        }
        .asm-empty p { font-size: 13px; margin: 0; }
      `}</style>
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
  const { data, isLoading, refetch } = useFetch<StaffPageData>(`/api/admin/staff?page=${currentPage}&limit=10${selectedDept ? `&department=${selectedDept}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`);

  // ADIM 4: Debounce arama — 300ms bekle, her tuşta API çağrısı yapma
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // ⚠️ Rules of Hooks: tüm hook çağrıları early return'ün ÜSTÜNDE olmalı.
  // Referans stabilliği için `data` değiştikçe array üret — downstream useMemo'ların
  // her render'da recompute olmasını engeller.
  const allStaff = useMemo(() => data?.staff ?? [], [data]);
  const allDepartments = useMemo(() => data?.departments ?? [], [data]);

  // ── Departman/Staff lookup map'leri (O(1) erişim, her render'da find() yerine) ──
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

  // ── Columns ──
  const columns: ColumnDef<Staff>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Personel',
      size: 250,
      cell: ({ row }) => {
        const dept = departmentMap.get(row.original.departmentId ?? '');
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ background: dept?.color || 'var(--color-primary)' }}>{row.original.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{row.getValue('name')}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{row.original.email}</p>
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
        const color = dept?.color || 'var(--color-primary)';
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold truncate" style={{ background: `${color}15`, color }}>
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
            {row.getValue('department')}
          </span>
        );
      },
    },
    { accessorKey: 'title', header: 'Unvan', size: 120, cell: ({ row }) => <span className="text-sm truncate block" style={{ color: 'var(--color-text-secondary)' }}>{row.getValue('title')}</span> },
    {
      accessorKey: 'completedTrainings',
      header: 'Eğitim',
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm font-mono font-medium">{row.getValue('completedTrainings')}/{row.original.assignedTrainings}</span>
      ),
    },
    {
      accessorKey: 'avgScore',
      header: 'Ort. Puan',
      size: 90,
      cell: ({ row }) => {
        const score = row.getValue('avgScore') as number;
        const color = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
        return <span className="text-sm font-mono font-bold" style={{ color }}>{score}%</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      size: 90,
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
      id: 'actions', header: '', size: 50,
      cell: ({ row }) => (
        <StaffActions staff={row.original} onChanged={refetch} />
      ),
    },
  ], [departmentMap, refetch]);

  // Early return — artık tüm hook'lar çağrıldıktan SONRA
  if (isLoading) {
    return <PageLoading />;
  }

  // API hatası olsa bile sayfayı boş veri ile render et (backend henüz yapılandırılmamış olabilir)
  const statsData = data?.stats ?? { totalStaff: 0, activeStaff: 0, departmentCount: 0, avgScore: 0 };
  const filteredStaff = allStaff;
  const selectedDeptData = selectedDept ? departmentMap.get(selectedDept) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <PageHeader
            title="Personel Yönetimi"
            subtitle="Departmanları ve personelleri görüntüle, yönet"
            action={{ label: 'Yeni Personel', icon: Plus, onClick: () => setShowAddStaff(true) }}
            secondaryAction={{ label: 'Toplu Yükle', icon: Upload, onClick: () => setShowBulkImport(true) }}
          />
        </div>
        <button
          onClick={() => router.push('/admin/staff/imports')}
          className="mt-2 inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-md hover:bg-(--color-surface-hover) transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Toplu yükleme geçmişi"
        >
          <History className="h-3.5 w-3.5" />
          Yükleme Geçmişi
        </button>
      </div>

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
              onClick={() => { setActiveView(v.key); setSelectedDept(null); setCurrentPage(1); setSearchQuery(''); }}
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
                    onClick={() => { setSelectedDept(dept.id); setCurrentPage(1); setSearchQuery(''); }}
                    className="group w-full text-left rounded-2xl border p-5 cursor-pointer transition-transform duration-200 hover:-translate-y-1"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 25px ${dept.color}20`; e.currentTarget.style.borderColor = `${dept.color}40`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDept(dept.id); setCurrentPage(1); setSearchQuery(''); } }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${dept.color}15` }}>
                        <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-(--color-surface-hover)"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Departman işlemleri"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); setEditingDept({ id: dept.id, name: dept.name, color: dept.color }); }}><Edit className="h-4 w-4" /> Düzenle</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={(e) => { e.stopPropagation(); setSelectedDept(dept.id); setShowAssignStaff(true); }}><UserPlus className="h-4 w-4" /> Personel Ekle</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-red-500"
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

                    <h3 className="text-base font-bold mb-1">{dept.name}</h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{dept.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {(staffByDeptMap.get(dept.id) ?? [])
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
                  onClick={() => { setSelectedDept(null); setCurrentPage(1); setSearchQuery(''); }}
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
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{data?.total ?? filteredStaff.length} personel</p>
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
                  <Trash2 className="h-4 w-4" /> {deletingDeptId === selectedDept ? 'Siliniyor...' : 'Sil'}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <DataTable columns={columns} data={filteredStaff} searchKey="name" searchPlaceholder="Bu departmanda ara..." onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)} totalCount={data?.total} pageCount={data?.totalPages} currentPage={currentPage} onPageChange={setCurrentPage} onSearchChange={handleSearch} />
            </div>
          </div>
        </BlurFade>
      )}

      {/* All Staff View */}
      {activeView === 'all' && (
        <BlurFade delay={0.05}>
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <DataTable columns={columns} data={allStaff} searchKey="name" searchPlaceholder="Personel ara (isim, e-posta)..." onRowClick={(staff) => router.push(`/admin/staff/${(staff as { id: string }).id}`)} totalCount={data?.total} pageCount={data?.totalPages} currentPage={currentPage} onPageChange={setCurrentPage} onSearchChange={handleSearch} />
          </div>
        </BlurFade>
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
          <div className="edm-form">
            <div className="edm-field">
              <Label className="edm-label">Departman Adı</Label>
              <Input
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="h-10"
                style={{ background: '#ffffff', borderColor: '#ebe7df' }}
              />
            </div>

            <div className="edm-field">
              <Label className="edm-label">Renk</Label>
              <div className="edm-swatches">
                {DEPARTMENT_COLORS.map((c) => {
                  const active = editingDept.color === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setEditingDept({ ...editingDept, color: c })}
                      className={`edm-swatch ${active ? 'edm-swatch-on' : ''}`}
                      style={{ background: c }}
                      aria-label={`Renk: ${c}`}
                    >
                      {active && <span className="edm-swatch-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="edm-preview">
              <span className="edm-preview-label">Önizleme</span>
              <div className="edm-preview-card" style={{ borderColor: `${editingDept.color}40`, background: `${editingDept.color}0c` }}>
                <div className="edm-preview-icon" style={{ background: `${editingDept.color}20`, color: editingDept.color }}>
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="edm-preview-name">{editingDept.name || 'Departman adı'}</span>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .edm-form { display: flex; flex-direction: column; gap: 22px; }
          .edm-field { display: flex; flex-direction: column; }
          :global(.edm-label) {
            font-family: var(--font-display, system-ui);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #6b6a63;
            margin-bottom: 8px;
            display: block;
          }
          .edm-swatches { display: flex; flex-wrap: wrap; gap: 10px; }
          .edm-swatch {
            width: 32px;
            height: 32px;
            border-radius: 999px;
            border: 2px solid transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            transition: transform 220ms cubic-bezier(0.16,1,0.3,1);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
          }
          .edm-swatch:hover { transform: scale(1.08); }
          .edm-swatch-on {
            border-color: #0a0a0a;
            transform: scale(1.05);
          }
          .edm-swatch-check { text-shadow: 0 1px 2px rgba(0,0,0,0.3); }

          .edm-preview {
            padding-top: 8px;
            border-top: 1px solid #ebe7df;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .edm-preview-label {
            font-family: var(--font-display, system-ui);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #8a8578;
          }
          .edm-preview-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid;
          }
          .edm-preview-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .edm-preview-name {
            font-family: var(--font-editorial, serif);
            font-size: 16px;
            font-weight: 500;
            font-variation-settings: 'opsz' 32;
            color: #0a0a0a;
            letter-spacing: -0.005em;
          }
        `}</style>
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
