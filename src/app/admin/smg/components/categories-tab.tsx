'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

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
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          SKS Aktivite Kategorileri
        </h3>
        <div className="flex gap-2">
          {categories.length === 0 && !isLoading && (
            <Button onClick={handleSeedStandards} disabled={seeding} variant="outline" className="gap-1.5 rounded-xl">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Standart SKS Kategorilerini Ekle
            </Button>
          )}
          <Button onClick={openCreate} className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> Kategori Ekle
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</div>
      ) : categories.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Henüz kategori tanımlanmamış. "Standart SKS Kategorilerini Ekle" butonunu kullanarak 7 standart kategoriyi hızlıca ekleyebilirsiniz.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                {['Sıra', 'Ad', 'Kod', 'Maks. Puan', 'Durum', 'İşlem'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.sortOrder}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{c.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>{c.code}</code>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{c.maxPointsPerActivity ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: c.isActive ? 'var(--color-success-bg)' : 'var(--color-surface-2)',
                        color: c.isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
                      }}>
                      {c.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg transition-colors" style={{ background: 'var(--color-surface-2)' }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg transition-colors" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
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
            <DialogTitle className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {editingId ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}
            </DialogTitle>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              SKS denetimi için kullanılacak SMG aktivite kategorisi tanımlayın.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                Ad <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Örn: Kurum İçi Eğitim"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                Kod <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="KURUM_ICI_EGITIM"
                className="rounded-xl font-mono"
              />
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Yalnızca büyük harf ve alt çizgi. Sistemde benzersiz olmalı.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                Açıklama <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(opsiyonel)</span>
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
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
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
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Boş bırakılırsa sınırsız</p>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                  Sıra
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  className="rounded-xl"
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Listede görünme sırası</p>
              </div>
            </div>
            <label
              className="flex items-center gap-2 text-sm cursor-pointer p-2.5 rounded-xl border"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>Aktif</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                Pasif kategoriler personel formunda görünmez
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting} className="rounded-xl">
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 rounded-xl"
              style={{ background: 'var(--color-primary)', color: 'white' }}
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
            <DialogTitle>Kategoriyi Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>"{deleteTarget?.name}"</span>{' '}
            kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-xl">
              İptal
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5 rounded-xl"
              style={{ background: 'var(--color-error)', color: 'white' }}
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
