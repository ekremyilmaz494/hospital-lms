'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, GripVertical, X, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { CategoryIcon, CATEGORY_ICON_NAMES } from '@/components/shared/category-icon';

const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  SURFACE_HOVER: '#f5f5f4',
  BG: '#fafaf9',
  BORDER: '#c9c4be',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  ERROR: '#ef4444',
  ERROR_BG: '#fee2e2',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

const ICON_COLORS = [
  K.PRIMARY, '#dc2626', '#7c3aed', '#e11d48', '#0284c7',
  '#f59e0b', '#0891b2', '#64748b', '#d97706', '#ec4899',
];

interface CategoryItem {
  id: string;
  value: string;
  label: string;
  icon: string;
  order: number;
  isDefault: boolean;
}

export default function CategoriesPage() {
  const { data: categories, isLoading, refetch } = useFetch<CategoryItem[]>('/api/admin/training-categories');
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('BookOpen');
  const [newColor, setNewColor] = useState(K.PRIMARY);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
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
      setNewColor(K.PRIMARY);
      refetch();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/training-categories/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Kategori silinemedi', 'error');
        return;
      }
      toast('Kategori silindi', 'success');
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
    <div className="k-page">
      {/* Header */}
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span>Ayarlar</span>
            <ChevronRight size={12} />
            <span data-current="true">Eğitim Kategorileri</span>
          </div>
          <h1 className="k-page-title">Eğitim Kategorileri</h1>
          <p className="k-page-subtitle">
            Eğitimleri gruplandırmak için kategori oluştur, düzenle, sırala.{' '}
            <strong style={{ color: K.TEXT_PRIMARY }}>{sorted.length}</strong> aktif kategori.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="k-btn k-btn-primary"
          >
            <Plus size={15} /> Yeni Kategori
          </button>
        </div>
      </header>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                background: K.SURFACE,
                border: `1.5px solid ${K.BORDER}`,
                borderRadius: 14,
                padding: 18,
                height: 120,
              }}
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div
          style={{
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            borderRadius: 16,
            padding: '64px 24px',
            textAlign: 'center',
            boxShadow: K.SHADOW_CARD,
          }}
        >
          <p style={{ color: K.TEXT_MUTED, fontSize: 14 }}>
            Eğitim kategorisi oluşturmak için &quot;Yeni Kategori&quot; butonunu kullanın.
          </p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {sorted.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === sorted.length - 1}
              onMove={handleMove}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* New Category Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md" style={{ background: K.SURFACE, borderColor: K.BORDER }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, color: K.TEXT_PRIMARY }}>
              Yeni Kategori Ekle
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            {/* Label input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: K.TEXT_MUTED,
                  marginBottom: 6,
                }}
              >
                Kategori Adı
              </label>
              <input
                type="text"
                placeholder="örn. Kardiyoloji"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                maxLength={30}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 14px',
                  background: K.SURFACE,
                  border: `1.5px solid ${K.BORDER}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: K.TEXT_PRIMARY,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 160ms ease, box-shadow 160ms ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = K.PRIMARY;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = K.BORDER;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <p style={{ marginTop: 6, fontSize: 11, color: K.TEXT_MUTED, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {newLabel.length}/30
              </p>
            </div>

            {/* Icon picker */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: K.TEXT_MUTED,
                  marginBottom: 8,
                }}
              >
                İkon
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {CATEGORY_ICON_NAMES.map(iconName => {
                  const active = newIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setNewIcon(iconName)}
                      title={iconName}
                      style={{
                        height: 40,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        background: active ? `color-mix(in srgb, ${newColor} 14%, transparent)` : K.BG,
                        border: `1.5px solid ${active ? newColor : K.BORDER_LIGHT}`,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <CategoryIcon
                        name={iconName}
                        className="h-4.5 w-4.5"
                        style={{ color: active ? newColor : K.TEXT_MUTED }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: K.TEXT_MUTED,
                  marginBottom: 8,
                }}
              >
                Renk
              </label>
              <div className="flex flex-wrap gap-2">
                {ICON_COLORS.map(color => {
                  const active = newColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: color,
                        border: `2px solid ${active ? K.TEXT_PRIMARY : 'transparent'}`,
                        outline: active ? `2px solid ${color}` : 'none',
                        outlineOffset: 2,
                        cursor: 'pointer',
                        transform: active ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 200ms ease',
                      }}
                      aria-label={`Renk: ${color}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 12,
                background: K.BG,
                border: `1.5px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `color-mix(in srgb, ${newColor} 14%, transparent)`,
                  flexShrink: 0,
                }}
              >
                <CategoryIcon name={newIcon} className="h-5 w-5" style={{ color: newColor }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>
                  {newLabel || 'Kategori Adı'}
                </div>
                <div style={{ fontSize: 11, color: K.TEXT_MUTED, fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                  {newIcon}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => { setModalOpen(false); setNewLabel(''); setNewIcon('BookOpen'); setNewColor(K.PRIMARY); }}
              disabled={saving}
              className="k-btn k-btn-ghost"
            >
              <X size={15} /> İptal
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newLabel.trim()}
              className="k-btn k-btn-primary"
            >
              <Save size={15} /> {saving ? 'Ekleniyor…' : 'Kategori Ekle'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" style={{ background: K.SURFACE, borderColor: K.BORDER }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, color: K.TEXT_PRIMARY }}>
              Kategoriyi Sil
            </DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 14, color: K.TEXT_SECONDARY, paddingBlock: 8, lineHeight: 1.55 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: K.TEXT_PRIMARY }}>
              <CategoryIcon name={deleteTarget?.icon ?? 'BookOpen'} className="h-4 w-4" style={{ color: K.PRIMARY }} />
              {deleteTarget?.label}
            </span>{' '}
            kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="k-btn k-btn-ghost"
            >
              İptal
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="k-btn"
              style={{ background: K.ERROR, color: '#fff' }}
            >
              <Trash2 size={15} /> {deleting ? 'Siliniyor…' : 'Sil'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Category Card ──
function CategoryCard({
  cat,
  index,
  isFirst,
  isLast,
  onMove,
  onDelete,
}: {
  cat: CategoryItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (cat: CategoryItem, dir: 'up' | 'down') => void;
  onDelete: (cat: CategoryItem) => void;
}) {
  // Renk: kategori ikonuna semantik renk dağıt (sıraya göre döngüsel)
  const accent = ICON_COLORS[index % ICON_COLORS.length];

  return (
    <article
      style={{
        position: 'relative',
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14,
        padding: 18,
        boxShadow: K.SHADOW_CARD,
        transition: 'border-color 200ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      className="group"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = K.BORDER;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Top row: icon + sort handle */}
      <div className="flex items-start justify-between">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          }}
        >
          <CategoryIcon name={cat.icon} className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            opacity: 0,
            transition: 'opacity 160ms ease',
          }}
          className="group-hover:opacity-100"
        >
          <button
            onClick={() => onMove(cat, 'up')}
            disabled={isFirst}
            aria-label="Yukarı taşı"
            style={{
              width: 24,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              borderRadius: 4,
              cursor: isFirst ? 'not-allowed' : 'pointer',
              opacity: isFirst ? 0.3 : 1,
            }}
          >
            <ChevronUp size={14} style={{ color: K.TEXT_MUTED }} />
          </button>
          <button
            onClick={() => onMove(cat, 'down')}
            disabled={isLast}
            aria-label="Aşağı taşı"
            style={{
              width: 24,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              borderRadius: 4,
              cursor: isLast ? 'not-allowed' : 'pointer',
              opacity: isLast ? 0.3 : 1,
            }}
          >
            <ChevronDown size={14} style={{ color: K.TEXT_MUTED }} />
          </button>
        </div>
      </div>

      {/* Label + slug */}
      <div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: K.TEXT_PRIMARY,
            fontFamily: K.FONT_DISPLAY,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {cat.label}
        </h3>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 4,
            padding: '2px 7px',
            borderRadius: 5,
            background: K.BG,
            border: `1px solid ${K.BORDER_LIGHT}`,
            fontSize: 10.5,
            color: K.TEXT_MUTED,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {cat.value}
        </div>
      </div>

      {/* Footer: order + delete */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 10,
          borderTop: `1px solid ${K.BORDER_LIGHT}`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: K.TEXT_MUTED,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <GripVertical size={12} /> #{index + 1}
        </span>
        <button
          onClick={() => onDelete(cat)}
          aria-label="Sil"
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            cursor: 'pointer',
            color: K.TEXT_MUTED,
            transition: 'background 160ms ease, color 160ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = K.ERROR_BG;
            e.currentTarget.style.color = K.ERROR;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = K.TEXT_MUTED;
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
