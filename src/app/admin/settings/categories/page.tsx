'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { CategoryIcon, CATEGORY_ICON_NAMES } from '@/components/shared/category-icon';

interface CategoryItem {
  id: string;
  value: string;
  label: string;
  icon: string;
  order: number;
  isDefault: boolean;
}

/** Color palette for icon picker */
const ICON_COLORS = [
  '#ef4444', '#f59e0b', '#0d9668', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#dc2626', '#64748b', '#10b981',
];

export default function CategoriesPage() {
  const { data: categories, isLoading, refetch } = useFetch<CategoryItem[]>('/api/admin/training-categories');
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('BookOpen');
  const [newColor, setNewColor] = useState('#0d9668');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sorted = [...(categories ?? [])].sort((a, b) => a.order - b.order);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/training-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), icon: newIcon }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Kategori eklenemedi', 'error');
        return;
      }
      toast('Kategori eklendi', 'success');
      setModalOpen(false);
      setNewLabel('');
      setNewIcon('BookOpen');
      refetch();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(cat: CategoryItem) {
    if (cat.isDefault) {
      toast('Varsayılan kategoriler silinemez', 'error');
      return;
    }
    setDeleteTarget(cat);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/training-categories/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Kategori silinemedi', 'error');
        return;
      }
      toast('Kategori silindi', 'success');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      refetch();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleMove(cat: CategoryItem, direction: 'up' | 'down') {
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const swapTarget = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/admin/training-categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: swapTarget.order }),
      }),
      fetch(`/api/admin/training-categories/${swapTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: cat.order }),
      }),
    ]);
    refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori Yönetimi"
        subtitle="Eğitim kategorilerini ekleyin, silin veya sıralayın"
        badge="Eğitimler"
        action={{
          label: 'Yeni Kategori',
          icon: Plus,
          onClick: () => setModalOpen(true),
        }}
      />

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, transparent 60%)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary-light)' }}
          >
            <Tags className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p className="text-sm font-bold">Kategoriler</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {sorted.length} kategori
            </p>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-border)' }} />
                <div className="h-3.5 w-32 rounded" style={{ background: 'var(--color-border)' }} />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Eğitim kategorisi oluşturmak için 'Yeni Kategori' butonunu kullanın.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {sorted.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--color-surface-hover)]">
                {/* Sıra */}
                <span
                  className="w-6 text-center text-xs font-mono font-semibold tabular-nums"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {idx + 1}
                </span>

                {/* İkon — Lucide icon with colored bg */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <CategoryIcon name={cat.icon} className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
                </div>

                {/* Label */}
                <span className="flex-1 text-sm font-medium">{cat.label}</span>

                {/* Slug */}
                <span
                  className="hidden sm:block rounded px-2 py-0.5 text-[10px] font-mono"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                >
                  {cat.value}
                </span>

                {/* Sırala */}
                <div className="flex flex-col">
                  <button
                    onClick={() => handleMove(cat, 'up')}
                    disabled={idx === 0}
                    className="rounded p-0.5 disabled:opacity-30 hover:bg-[var(--color-bg)]"
                    aria-label="Yukarı taşı"
                  >
                    <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                  <button
                    onClick={() => handleMove(cat, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="rounded p-0.5 disabled:opacity-30 hover:bg-[var(--color-bg)]"
                    aria-label="Aşağı taşı"
                  >
                    <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                </div>

                {/* Sil — varsayılan kategorilerde gizle */}
                {!cat.isDefault && (
                  <button
                    onClick={() => openDelete(cat)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-error-bg)]"
                    aria-label="Sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Yeni Kategori Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kategori Ekle</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                Kategori Adı
              </Label>
              <Input
                placeholder="örn. Kardiyoloji"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                maxLength={30}
                className="h-10"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <p className="mt-1 text-right text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {newLabel.length}/30
              </p>
            </div>

            {/* Icon Picker */}
            <div>
              <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                İkon Seç
              </Label>
              <div className="grid grid-cols-8 gap-1.5">
                {CATEGORY_ICON_NAMES.map(iconName => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setNewIcon(iconName)}
                    className="flex h-10 w-full items-center justify-center rounded-xl transition-all duration-150"
                    style={{
                      background: newIcon === iconName ? `color-mix(in srgb, ${newColor} 15%, transparent)` : 'var(--color-bg)',
                      border: `2px solid ${newIcon === iconName ? newColor : 'var(--color-border)'}`,
                      boxShadow: newIcon === iconName ? `0 2px 8px color-mix(in srgb, ${newColor} 20%, transparent)` : 'none',
                    }}
                    title={iconName}
                  >
                    <CategoryIcon
                      name={iconName}
                      className="h-4.5 w-4.5"
                      style={{ color: newIcon === iconName ? newColor : 'var(--color-text-muted)' }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                İkon Rengi
              </Label>
              <div className="flex flex-wrap gap-2">
                {ICON_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className="h-7 w-7 rounded-full transition-all duration-150"
                    style={{
                      background: color,
                      border: `2.5px solid ${newColor === color ? 'var(--color-text-primary)' : 'transparent'}`,
                      outline: newColor === color ? `2px solid ${color}` : 'none',
                      outlineOffset: '2px',
                      transform: newColor === color ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              className="flex items-center justify-center gap-3 rounded-xl py-3"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${newColor} 12%, transparent)` }}
              >
                <CategoryIcon name={newIcon} className="h-5 w-5" style={{ color: newColor }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {newLabel || 'Kategori Adı'}
                </p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  {newIcon}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setNewLabel(''); }} disabled={saving}>
              İptal
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !newLabel.trim()}
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              {saving ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Silme Onay Modal ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kategoriyi Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="inline-flex items-center gap-1.5 font-bold">
              <CategoryIcon name={deleteTarget?.icon ?? 'BookOpen'} className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              {deleteTarget?.label}
            </span>
            {' '}kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              İptal
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: 'var(--color-error)', color: 'white' }}
            >
              {deleting ? 'Siliniyor...' : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
