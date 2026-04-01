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

interface CategoryItem {
  id: string;
  value: string;
  label: string;
  icon: string;
  order: number;
  isDefault: boolean;
}

const HEALTH_EMOJIS = [
  '🦠', '🧬', '💉', '🩺', '🏥', '🩻', '🔬', '💊',
  '🚑', '🩸', '🧪', '🫀', '🫁', '🦴', '🩹', '🧠',
  '👁️', '🦷', '🩼', '👨‍⚕️', '🌡️', '🧴', '🫶', '📋',
];

export default function CategoriesPage() {
  const { data: categories, isLoading, refetch } = useFetch<CategoryItem[]>('/api/admin/training-categories');
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📚');
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
      setNewIcon('📚');
      refetch();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openDelete(cat: CategoryItem) {
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
    // İki kategoriyi swap et
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
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz kategori yok</p>
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

                {/* İkon */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  {cat.icon}
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

                {/* Sil */}
                <button
                  onClick={() => openDelete(cat)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-error-bg)]"
                  aria-label="Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />
                </button>
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

            <div>
              <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                İkon Seç
              </Label>
              <div className="grid grid-cols-8 gap-1.5">
                {HEALTH_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewIcon(emoji)}
                    className="flex h-9 w-full items-center justify-center rounded-lg text-lg transition-all"
                    style={{
                      background: newIcon === emoji ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      border: `2px solid ${newIcon === emoji ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-sm">
                Seçilen: <span className="text-lg">{newIcon}</span>
              </p>
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
            <strong>{deleteTarget?.icon} {deleteTarget?.label}</strong> kategorisini silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz.
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
