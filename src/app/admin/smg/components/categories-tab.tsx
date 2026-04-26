'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface Category {
  id: string;
  name: string;
  code: string;
  description: string | null;
  maxPointsPerActivity: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface CategoriesData {
  categories: Category[];
}

const STANDARD_CATEGORIES = [
  { code: 'KURUM_ICI_EGITIM', name: 'Kurum İçi Eğitim', sortOrder: 1, maxPointsPerActivity: null as number | null },
  { code: 'TTB_KREDILI_KONGRE', name: 'TTB Kredili Kongre/Sempozyum', sortOrder: 2, maxPointsPerActivity: 20 },
  { code: 'MESLEKI_DERNK_KURSU', name: 'Mesleki Dernek Kursu', sortOrder: 3, maxPointsPerActivity: 15 },
  { code: 'UNIVERSITE_SERTIFIKA', name: 'Üniversite Sertifika Programı', sortOrder: 4, maxPointsPerActivity: null as number | null },
  { code: 'ONLINE_EGITIM', name: 'Online/Uzaktan Eğitim', sortOrder: 5, maxPointsPerActivity: 10 },
  { code: 'YAYIN_MAKALE', name: 'Yayın/Makale', sortOrder: 6, maxPointsPerActivity: null as number | null },
  { code: 'SIMULASYON_EGITIMI', name: 'Simülasyon Eğitimi', sortOrder: 7, maxPointsPerActivity: null as number | null },
];

const EMPTY_FORM = { name: '', code: '', description: '', maxPointsPerActivity: '', isActive: true, sortOrder: '0' };

export function CategoriesTab() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useFetch<CategoriesData>('/api/admin/smg/categories');
  const categories = data?.categories ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      description: c.description ?? '',
      maxPointsPerActivity: c.maxPointsPerActivity?.toString() ?? '',
      isActive: c.isActive,
      sortOrder: c.sortOrder.toString(),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.code) {
      toast('Ad ve kod zorunludur.', 'error');
      return;
    }
    if (!/^[A-Z_]+$/.test(form.code)) {
      toast('Kod yalnızca büyük harf ve alt çizgi içerebilir.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        maxPointsPerActivity: form.maxPointsPerActivity ? Number(form.maxPointsPerActivity) : null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const url = editingId ? `/api/admin/smg/categories/${editingId}` : '/api/admin/smg/categories';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'İşlem başarısız.', 'error');
        return;
      }
      toast(editingId ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.', 'success');
      setModalOpen(false);
      refetch?.();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/smg/categories/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'Silme başarısız.', 'error');
        return;
      }
      toast('Kategori silindi.', 'success');
      setDeleteTarget(null);
      refetch?.();
    } finally {
      setDeleting(false);
    }
  };

  const handleSeedStandards = async () => {
    setSeeding(true);
    try {
      let success = 0;
      const failures: string[] = [];
      for (const c of STANDARD_CATEGORIES) {
        const res = await fetch('/api/admin/smg/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c),
        });
        if (res.ok) {
          success++;
        } else {
          const err = await res.json().catch(() => ({}));
          failures.push(`${c.name}: ${err.error ?? res.statusText}`);
        }
      }
      if (success > 0 && failures.length === 0) {
        toast(`${success} kategori eklendi.`, 'success');
      } else if (success > 0) {
        toast(`${success} kategori eklendi, ${failures.length} mevcut atlandı.`, 'success');
      } else {
        toast(`Hiç kategori eklenemedi: ${failures[0] ?? 'bilinmeyen hata'}`, 'error');
      }
      refetch?.();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>
          SKS Aktivite Kategorileri
        </h3>
        <div className="flex gap-2">
          {categories.length === 0 && !isLoading && (
            <Button
              onClick={handleSeedStandards}
              disabled={seeding}
              variant="outline"
              className="gap-1.5 rounded-xl"
              style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Standart SKS Kategorilerini Ekle
            </Button>
          )}
          <Button
            onClick={openCreate}
            className="gap-1.5 rounded-xl"
            style={{ background: K.PRIMARY, color: '#ffffff' }}
          >
            <Plus className="h-4 w-4" /> Kategori Ekle
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Yükleniyor...</div>
      ) : categories.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>
          Henüz kategori tanımlanmamış. &quot;Standart SKS Kategorilerini Ekle&quot; butonunu kullanarak 7 standart kategoriyi hızlıca ekleyebilirsiniz.
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl"
          style={{ border: `1.5px solid ${K.BORDER}`, background: K.SURFACE, boxShadow: K.SHADOW_CARD }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
                {['Sıra', 'Ad', 'Kod', 'Maks. Puan', 'Durum', 'İşlem'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold uppercase tracking-wide"
                    style={{ color: K.TEXT_MUTED, fontSize: 11 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                  <td className="px-4 py-3 text-xs" style={{ color: K.TEXT_MUTED }}>{c.sortOrder}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: K.TEXT_PRIMARY }}>{c.name}</td>
                  <td className="px-4 py-3">
                    <code
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: K.BG, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER_LIGHT}` }}
                    >
                      {c.code}
                    </code>
                  </td>
                  <td className="px-4 py-3" style={{ color: K.TEXT_SECONDARY }}>{c.maxPointsPerActivity ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: c.isActive ? K.SUCCESS_BG : K.BG,
                        color: c.isActive ? K.SUCCESS : K.TEXT_MUTED,
                      }}
                    >
                      {c.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg"
                        style={{ background: K.BG, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER_LIGHT}` }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg"
                        style={{ background: K.ERROR_BG, color: K.ERROR }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>
              {editingId ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}
            </DialogTitle>
            <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED }}>
              SKS denetimi için kullanılacak SMG aktivite kategorisi tanımlayın.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>
                Ad <span style={{ color: K.ERROR }}>*</span>
              </label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Örn: Kurum İçi Eğitim"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>
                Kod <span style={{ color: K.ERROR }}>*</span>
              </label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="KURUM_ICI_EGITIM"
                className="rounded-xl font-mono"
              />
              <p className="text-[11px] mt-1" style={{ color: K.TEXT_MUTED }}>
                Yalnızca büyük harf ve alt çizgi. Sistemde benzersiz olmalı.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>
                Açıklama <span className="font-normal" style={{ color: K.TEXT_MUTED }}>(opsiyonel)</span>
              </label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Bu kategori hangi aktiviteleri kapsar?"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>
                  Maks. Puan/Aktivite
                </label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxPointsPerActivity}
                  onChange={e => setForm(f => ({ ...f, maxPointsPerActivity: e.target.value }))}
                  placeholder="Sınırsız"
                  className="rounded-xl"
                />
                <p className="text-[11px] mt-1" style={{ color: K.TEXT_MUTED }}>Boş bırakılırsa sınırsız</p>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>
                  Sıra
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  className="rounded-xl"
                />
                <p className="text-[11px] mt-1" style={{ color: K.TEXT_MUTED }}>Listede görünme sırası</p>
              </div>
            </div>
            <label
              className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-xl"
              style={{ border: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4"
                style={{ accentColor: K.PRIMARY }}
              />
              <span className="font-medium" style={{ color: K.TEXT_PRIMARY }}>Aktif</span>
              <span className="text-xs ml-auto" style={{ color: K.TEXT_MUTED }}>
                Pasif kategoriler personel formunda görünmez
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
              className="rounded-xl"
              style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
            >
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 rounded-xl"
              style={{ background: K.PRIMARY, color: '#ffffff' }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>Kategoriyi Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: K.TEXT_SECONDARY }}>
            <span className="font-semibold" style={{ color: K.TEXT_PRIMARY }}>&quot;{deleteTarget?.name}&quot;</span>{' '}
            kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-xl"
              style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
            >
              İptal
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5 rounded-xl"
              style={{ background: K.ERROR, color: '#ffffff' }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
