'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Library, Clock, Star, CheckCircle2, Plus, Layers, X, ArrowRight,
  Film, Sparkles, Search,
  BookOpen, GraduationCap, Upload, AlertCircle, Trash2,
} from 'lucide-react'
import { generateVideoThumbnail } from '@/lib/video-thumbnail'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useToast } from '@/components/shared/toast'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
  type ContentLibraryCategoryKey,
  type ContentLibraryDifficulty,
} from '@/lib/content-library-categories'

interface ContentLibraryItem {
  id: string
  title: string
  description: string | null
  category: string
  thumbnailUrl: string | null
  duration: number
  smgPoints: number
  difficulty: string
  targetRoles: string[]
  isActive: boolean
  isInstalled: boolean
  isOwned?: boolean
}

interface PageData {
  items: ContentLibraryItem[]
}

// ── Toplu Ekle Modali ─────────────────────────────────────────────────────

interface BulkInstallModalProps {
  items: ContentLibraryItem[]
  onClose: () => void
  onSuccess: () => void
}

function BulkInstallModal({ items, onClose, onSuccess }: BulkInstallModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const uninstalledInCategory = items.filter(
    i => i.category === selectedCategory && !i.isInstalled
  )

  const handleInstall = async () => {
    if (!selectedCategory) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/content-library/bulk-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız')
      toast(
        data.installed > 0
          ? `${data.installed} içerik kurumunuza eklendi${data.skipped > 0 ? `, ${data.skipped} zaten mevcuttu` : ''}`
          : 'Bu kategorideki tüm içerikler zaten eklenmiş',
        'success'
      )
      onSuccess()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'color-mix(in srgb, var(--color-border) 60%, transparent)',
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ background: 'radial-gradient(ellipse at top, var(--color-primary), transparent 70%)' }}
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))' }}
              >
                <Layers className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                  Toplu İçerik Ekle
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Kategori bazlı hızlı kurulum</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-[var(--color-surface-hover)]">
              <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Kategori Seç
            </label>
            <select
              className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="">Kategori seçin...</option>
              {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
                const total = items.filter(i => i.category === key).length
                const uninstalled = items.filter(i => i.category === key && !i.isInstalled).length
                return (
                  <option key={key} value={key}>
                    {cfg.label} — {total} içerik ({uninstalled} eklenecek)
                  </option>
                )
              })}
            </select>
          </div>

          {selectedCategory && (
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{
                background: uninstalledInCategory.length > 0 ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
                border: `1px solid ${uninstalledInCategory.length > 0 ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'transparent'}`,
              }}
            >
              {uninstalledInCategory.length > 0 ? (
                <>
                  <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {uninstalledInCategory.length} içerik kurumunuza eklenecek
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Bu kategorideki tüm içerikler zaten eklenmiş.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ color: 'var(--color-text-secondary)' }}>
              İptal
            </button>
            <button
              onClick={handleInstall}
              disabled={!selectedCategory || loading || uninstalledInCategory.length === 0}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-all duration-200 hover:shadow-lg disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))' }}>
              <Plus className="h-4 w-4" />
              {loading ? 'Ekleniyor...' : `${uninstalledInCategory.length} İçerik Ekle`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── İçerik Kartı ─────────────────────────────────────────────────────────

interface ContentCardProps {
  item: ContentLibraryItem
  onInstall: (id: string) => Promise<void>
  installing: boolean
  onDelete: (item: ContentLibraryItem) => void
  deleting: boolean
}

// ── Silme Onay Modali ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  item: ContentLibraryItem
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

function DeleteConfirmModal({ item, loading, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'color-mix(in srgb, var(--color-error) 30%, var(--color-border))',
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-error-bg)' }}
          >
            <AlertCircle className="h-6 w-6" style={{ color: 'var(--color-error)' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold font-heading" style={{ fontSize: '16px', color: 'var(--color-text-primary)' }}>
              İçeriği silmek istediğinize emin misiniz?
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                &ldquo;{item.title}&rdquo;
              </span>{' '}
              kalıcı olarak silinecek. Depolamadaki dosyalar da kaldırılacak.
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Eğer bu içerik bir eğitimde kullanılıyorsa silme reddedilecek — önce ilgili eğitimi silmelisiniz.
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-6 py-4"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg disabled:opacity-60"
            style={{ background: 'var(--color-error)' }}
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Siliniyor...' : 'Evet, sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentCard({ item, onInstall, installing, onDelete, deleting }: ContentCardProps) {
  const router = useRouter()
  const cat = CONTENT_LIBRARY_CATEGORIES[item.category as ContentLibraryCategoryKey]
  const diff = CONTENT_LIBRARY_DIFFICULTY[item.difficulty as ContentLibraryDifficulty]
  const roleLabels = CONTENT_LIBRARY_TARGET_ROLES.filter(r => item.targetRoles.includes(r.value))
  const catColor = cat?.color ?? 'var(--color-primary)'

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 12px 32px -8px color-mix(in srgb, ${catColor} 20%, transparent)`
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${catColor} 30%, var(--color-border))`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
    >
      {/* Thumbnail / Gradient Banner */}
      <div className="relative h-36 shrink-0 overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${catColor} 12%, var(--color-surface)), color-mix(in srgb, ${catColor} 25%, var(--color-surface)))`,
            }}
          >
            <div className="relative">
              <Library className="h-12 w-12 opacity-20" style={{ color: catColor }} />
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ filter: 'blur(12px)' }}
              >
                <Library className="h-12 w-12 opacity-40" style={{ color: catColor }} />
              </div>
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `linear-gradient(to top, color-mix(in srgb, ${catColor} 15%, transparent), transparent 50%)` }}
        />

        {/* Badge overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold backdrop-blur-md"
            style={{ background: `color-mix(in srgb, ${catColor} 90%, #000)`, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {cat?.label ?? item.category}
          </span>
          <span className="rounded-lg px-2 py-1 text-[10px] font-bold backdrop-blur-md"
            style={{ background: `color-mix(in srgb, ${diff?.color ?? '#888'} 90%, #000)`, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {diff?.label ?? item.difficulty}
          </span>
        </div>

        {/* Top-right badges */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {item.isOwned && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(item) }}
              disabled={deleting}
              title="İçeriği sil"
              aria-label="İçeriği sil"
              className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white backdrop-blur-md transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50"
              style={{
                background: 'var(--color-error)',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--color-error) 40%, transparent)',
                border: '1.5px solid rgba(255,255,255,0.2)',
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          )}
          {item.isInstalled && (
            <div className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
          )}
        </div>
      </div>

      {/* İçerik */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-bold font-heading leading-snug" style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
          {item.title}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {item.description}
          </p>
        )}

        {/* Stats bar */}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-2"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {item.duration} dk
            </span>
          </div>
          <div className="h-3 w-px" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              {item.smgPoints} SMG
            </span>
          </div>
        </div>

        {/* Hedef Roller */}
        {roleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {roleLabels.map(r => (
              <span key={r.value} className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
                {r.label}
              </span>
            ))}
          </div>
        )}

        {/* Eylem butonu */}
        <div className="mt-auto pt-1">
          {item.isInstalled ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 className="h-4 w-4" />
                Eklendi
              </div>
              <button
                onClick={() => router.push('/admin/trainings')}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Git
              </button>
            </div>
          ) : (
            <button
              onClick={() => onInstall(item.id)}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 hover:shadow-lg disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))' }}
            >
              {installing ? (
                <span>Ekleniyor...</span>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4" />
                  Eğitim olarak ata
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Eğitim Videolarım Tipleri ──────────────────────────────────────────────
//
// my-videos API'si ContentLibrary öğelerini döndürür — yalnızca bu kurumun
// eğitimlerinde kullanılan olanlar (Training.sourceLibraryId ile bağlı).

interface UsedTrainingRef {
  id: string
  title: string
  publishStatus: string
}

interface MyVideoLibraryItem extends Omit<ContentLibraryItem, 'isInstalled'> {
  usageCount: number
  usedInTrainings: UsedTrainingRef[]
}

interface MyVideosData {
  items: MyVideoLibraryItem[]
}

// ── Kendi Eğitim Videolarım Sekmesi ────────────────────────────────────────
//
// Bu sekme yalnızca bu kurumun bir eğitiminde kullanılmış ContentLibrary
// öğelerini listeler. Platform Kütüphanesi'yle aynı kart layoutunu kullanır;
// ek olarak her kartın altında "Kullanıldığı eğitim(ler)" bilgisi gösterilir.

function MyVideosTab() {
  const router = useRouter()
  const { data, isLoading, error } = useFetch<MyVideosData>('/api/admin/content-library/my-videos')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  if (isLoading) return <PageLoading />
  if (error) return (
    <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--color-error)' }}>
      {error}
    </div>
  )

  const allItems = data?.items ?? []
  const afterCategory = categoryFilter
    ? allItems.filter(i => i.category === categoryFilter)
    : allItems
  const filtered = searchQuery
    ? afterCategory.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : afterCategory

  const totalDurationMin = allItems.reduce((s, i) => s + i.duration, 0)
  const totalSmg = allItems.reduce((s, i) => s + i.smgPoints, 0)
  const linkedTrainingIds = new Set(
    allItems.flatMap(i => i.usedInTrainings.map(t => t.id))
  )

  return (
    <div className="space-y-5">
      {/* Stats + Search bar */}
      {allItems.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            {[
              { label: 'İçerik', value: allItems.length, icon: Library, color: 'var(--color-primary)' },
              { label: 'Eğitimde', value: linkedTrainingIds.size, icon: GraduationCap, color: 'var(--color-info)' },
              { label: 'Süre', value: `${totalDurationMin}dk`, icon: Clock, color: 'var(--color-accent)' },
              { label: 'SMG', value: totalSmg, icon: Star, color: 'var(--color-accent)' },
            ].map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${stat.color} 10%, transparent)` }}
                >
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-base font-bold font-heading leading-none" style={{ color: 'var(--color-text-primary)' }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="İçerik ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', width: '220px' }}
            />
          </div>
        </div>
      )}

      {/* Kategori Filtreleri */}
      {allItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className="rounded-xl px-4 py-2 text-[11px] font-bold transition-all duration-200"
            style={{
              background: !categoryFilter ? 'var(--color-primary)' : 'var(--color-surface)',
              color: !categoryFilter ? '#fff' : 'var(--color-text-muted)',
              border: `1.5px solid ${!categoryFilter ? 'var(--color-primary)' : 'var(--color-border)'}`,
              boxShadow: !categoryFilter ? '0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
            }}
          >
            Tümü ({allItems.length})
          </button>
          {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
            const count = allItems.filter(i => i.category === key).length
            if (count === 0) return null
            const active = categoryFilter === key
            return (
              <button
                key={key}
                onClick={() => setCategoryFilter(active ? null : key)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold transition-all duration-200"
                style={{
                  background: active ? cfg.color : 'var(--color-surface)',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  border: `1.5px solid ${active ? cfg.color : 'var(--color-border)'}`,
                  boxShadow: active ? `0 4px 12px color-mix(in srgb, ${cfg.color} 25%, transparent)` : 'none',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? '#fff' : cfg.color }}
                />
                {cfg.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* İçerik Kartları */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(item => (
            <MyVideoCard
              key={item.id}
              item={item}
              onNavigate={(trainingId) => router.push(`/admin/trainings/${trainingId}/edit`)}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-20 gap-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-bg)' }}
          >
            {searchQuery ? (
              <Search className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
            ) : (
              <Film className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
              {searchQuery
                ? `"${searchQuery}" için sonuç bulunamadı`
                : categoryFilter
                  ? 'Bu kategoride kullanılan içerik yok'
                  : 'Henüz bir eğitime bağlanmış içerik yok'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {searchQuery
                ? 'Farklı bir arama deneyin'
                : categoryFilter
                  ? 'Filtreyi temizleyerek tümünü görün'
                  : 'Platform Kütüphanesi\'nden bir içeriği eğitim olarak atadığınızda burada görünür'}
            </p>
          </div>
          {(categoryFilter || searchQuery) && (
            <button
              onClick={() => { setCategoryFilter(null); setSearchQuery('') }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" /> Filtreleri Temizle
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Eğitim Videolarım Kartı ────────────────────────────────────────────────
//
// ContentCard'ın kompakt varyantı. Install butonu yok — aksiyon alanında
// içeriği kullanan eğitim(ler)e link verir. Birden fazla eğitim varsa ilki,
// yoksa ilkinin edit sayfasına yönlendirir.

interface MyVideoCardProps {
  item: MyVideoLibraryItem
  onNavigate: (trainingId: string) => void
}

function MyVideoCard({ item, onNavigate }: MyVideoCardProps) {
  const cat = CONTENT_LIBRARY_CATEGORIES[item.category as ContentLibraryCategoryKey]
  const diff = CONTENT_LIBRARY_DIFFICULTY[item.difficulty as ContentLibraryDifficulty]
  const catColor = cat?.color ?? 'var(--color-primary)'
  const primaryTraining = item.usedInTrainings[0]

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 12px 32px -8px color-mix(in srgb, ${catColor} 20%, transparent)`
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${catColor} 30%, var(--color-border))`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-36 shrink-0 overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${catColor} 12%, var(--color-surface)), color-mix(in srgb, ${catColor} 25%, var(--color-surface)))`,
            }}
          >
            <Library className="h-12 w-12 opacity-20" style={{ color: catColor }} />
          </div>
        )}

        {/* Kategori / zorluk rozetleri */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <span
            className="rounded-lg px-2.5 py-1 text-[10px] font-bold backdrop-blur-md"
            style={{ background: `color-mix(in srgb, ${catColor} 90%, #000)`, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            {cat?.label ?? item.category}
          </span>
          <span
            className="rounded-lg px-2 py-1 text-[10px] font-bold backdrop-blur-md"
            style={{ background: `color-mix(in srgb, ${diff?.color ?? '#888'} 90%, #000)`, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            {diff?.label ?? item.difficulty}
          </span>
        </div>

        {/* Kullanım rozeti */}
        <div className="absolute top-3 right-3">
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          >
            <GraduationCap className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-success)' }}>
              {item.usageCount} eğitim
            </span>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-bold font-heading leading-snug" style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
          {item.title}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {item.description}
          </p>
        )}

        {/* Stats */}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-2"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {item.duration} dk
            </span>
          </div>
          <div className="h-3 w-px" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              {item.smgPoints} SMG
            </span>
          </div>
        </div>

        {/* Eğitim linki */}
        {primaryTraining && (
          <div className="mt-auto pt-1">
            <button
              onClick={() => onNavigate(primaryTraining.id)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                <span className="truncate">
                  {item.usageCount > 1
                    ? `${primaryTraining.title} +${item.usageCount - 1}`
                    : primaryTraining.title}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


// ── İçerik Yükleme Modalı ────────────────────────────────────────────────

interface UploadContentModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface FileUploadState {
  fileName: string
  loaded: number
  total: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

function UploadContentModal({ onClose, onSuccess }: UploadContentModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<string>('BASIC')
  const [smgPoints, setSmgPoints] = useState<number | ''>('')
  const [targetRoles, setTargetRoles] = useState<string[]>(['all'])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, FileUploadState>>({})

  const toggleRole = (role: string) => {
    setTargetRoles(prev => {
      if (role === 'all') return ['all']
      const next = prev.filter(r => r !== 'all')
      return next.includes(role) ? next.filter(r => r !== role) : [...next, role]
    })
  }

  const handleFilesChange = (fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList).slice(0, 20)
    setSelectedFiles(files)
    if (!title && files[0]) {
      setTitle(files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast('Lütfen en az bir dosya seçin', 'error')
      return
    }
    if (!title.trim()) {
      toast('Başlık zorunlu', 'error')
      return
    }
    if (!category) {
      toast('Kategori zorunlu', 'error')
      return
    }

    setUploading(true)

    const payload = selectedFiles.map((f, idx) => ({
      fileName: f.name,
      contentType: f.type,
      title: selectedFiles.length === 1 ? title : `${title}${selectedFiles.length > 1 ? ` (${idx + 1})` : ''}`,
      category,
      description: description || undefined,
      difficulty,
      targetRoles,
      smgPoints: typeof smgPoints === 'number' ? smgPoints : undefined,
    }))

    try {
      const res = await fetch('/api/admin/content-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast(err.error || 'Yükleme başlatılamadı', 'error')
        setUploading(false)
        return
      }

      const { results } = await res.json() as {
        results: Array<{
          id?: string
          uploadUrl?: string
          thumbnailUploadUrl?: string | null
          fileName: string
          error?: string
        }>
      }

      // Hatalı sonuçları topla
      const failedPresign = results.filter(r => !r.uploadUrl)
      for (const f of failedPresign) {
        setProgress(prev => ({
          ...prev,
          [f.fileName]: { fileName: f.fileName, loaded: 0, total: 0, status: 'error', error: f.error ?? 'Hata' },
        }))
      }

      const uploads = results
        .filter((r): r is { id: string; uploadUrl: string; thumbnailUploadUrl?: string | null; fileName: string } =>
          !!r.uploadUrl && !!r.id,
        )
        .map(result => {
          const file = selectedFiles.find(f => f.name === result.fileName)
          if (!file) return Promise.resolve({ ok: false, id: result.id, fileName: result.fileName })

          setProgress(prev => ({
            ...prev,
            [result.fileName]: { fileName: result.fileName, loaded: 0, total: file.size, status: 'uploading' },
          }))

          if (file.type.startsWith('video/') && result.thumbnailUploadUrl) {
            generateVideoThumbnail(file).then(blob => {
              if (!blob || !result.thumbnailUploadUrl) return
              fetch(result.thumbnailUploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'image/jpeg' },
                body: blob,
              }).catch(() => {})
            }).catch(() => {})
          }

          return new Promise<{ ok: boolean; id: string; fileName: string }>(resolve => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = e => {
              if (e.lengthComputable) {
                setProgress(prev => ({
                  ...prev,
                  [result.fileName]: {
                    fileName: result.fileName,
                    loaded: e.loaded,
                    total: e.total,
                    status: 'uploading',
                  },
                }))
              }
            }
            xhr.onload = () => {
              const ok = xhr.status >= 200 && xhr.status < 300
              setProgress(prev => ({
                ...prev,
                [result.fileName]: {
                  fileName: result.fileName,
                  loaded: file.size,
                  total: file.size,
                  status: ok ? 'done' : 'error',
                },
              }))
              resolve({ ok, id: result.id, fileName: result.fileName })
            }
            xhr.onerror = () => {
              setProgress(prev => ({
                ...prev,
                [result.fileName]: {
                  fileName: result.fileName,
                  loaded: 0,
                  total: file.size,
                  status: 'error',
                },
              }))
              resolve({ ok: false, id: result.id, fileName: result.fileName })
            }
            xhr.open('PUT', result.uploadUrl)
            xhr.setRequestHeader('Content-Type', file.type)
            xhr.send(file)
          })
        })

      const uploadResults = await Promise.all(uploads)
      const succeeded = uploadResults.filter(r => r.ok).length
      const failed = uploadResults.length - succeeded

      if (succeeded > 0 && failed === 0) {
        toast(`${succeeded} içerik yüklendi`, 'success')
        onSuccess()
        onClose()
      } else if (succeeded > 0 && failed > 0) {
        toast(`${succeeded} yüklendi, ${failed} başarısız`, 'error')
        onSuccess()
      } else {
        toast('Yükleme başarısız', 'error')
      }
    } catch {
      toast('Yükleme sırasında bir hata oluştu', 'error')
    } finally {
      setUploading(false)
    }
  }, [selectedFiles, title, category, description, difficulty, targetRoles, smgPoints, toast, onSuccess, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'color-mix(in srgb, var(--color-border) 60%, transparent)',
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))' }}
            >
              <Upload className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                İçerik Yükle
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Video, PDF veya ses dosyası</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Dosya seç */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Dosya <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <Upload className="h-4 w-4" />
              {selectedFiles.length > 0
                ? `${selectedFiles.length} dosya seçildi`
                : 'Dosya seç (video, PDF, ses)'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*,.pdf,.pptx"
              className="hidden"
              onChange={e => {
                handleFilesChange(e.target.files)
                e.target.value = ''
              }}
            />
            {selectedFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {selectedFiles.map(f => (
                  <li key={f.name} className="truncate">• {f.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Başlık */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Başlık <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Örn. Enfeksiyon Kontrolü Eğitimi"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Kategori <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={uploading}
              className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Kategori seçin...</option>
              {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Açıklama (opsiyonel) */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Açıklama <span style={{ color: 'var(--color-text-muted)' }}>(opsiyonel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={uploading}
              rows={2}
              className="w-full resize-none rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Opsiyonel alanlar */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              Gelişmiş seçenekler (opsiyonel)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  Zorluk
                </label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-[var(--color-primary)]"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {Object.entries(CONTENT_LIBRARY_DIFFICULTY).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  Hedef Roller
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_LIBRARY_TARGET_ROLES.map(r => {
                    const active = targetRoles.includes(r.value)
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRole(r.value)}
                        disabled={uploading}
                        className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
                        style={{
                          background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: active ? '#fff' : 'var(--color-text-secondary)',
                          border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  SMG Puanı
                </label>
                <input
                  type="number"
                  min={0}
                  value={smgPoints}
                  onChange={e => setSmgPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={uploading}
                  placeholder="0"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>
          </details>

          {/* Progress */}
          {Object.keys(progress).length > 0 && (
            <div className="space-y-2 rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
              {Object.values(progress).map(p => {
                const pct = p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0
                return (
                  <div key={p.fileName} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {p.status === 'error' && <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-error)' }} />}
                        {p.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-success)' }} />}
                        <span className="truncate">{p.fileName}</span>
                      </span>
                      <span
                        className="shrink-0 font-mono text-[10px] font-bold tabular-nums"
                        style={{
                          color:
                            p.status === 'error' ? 'var(--color-error)'
                              : p.status === 'done' ? 'var(--color-success)'
                                : 'var(--color-primary)',
                        }}
                      >
                        {p.status === 'error' ? 'HATA' : `${pct}%`}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--color-border)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background:
                            p.status === 'error' ? 'var(--color-error)'
                              : p.status === 'done' ? 'var(--color-success)'
                                : 'var(--color-primary)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={uploading}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              İptal
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !title.trim() || !category}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40 hover:shadow-lg disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))' }}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Platform Kütüphanesi Sekmesi ──────────────────────────────────────────

function PlatformLibraryTab() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useFetch<PageData>('/api/admin/content-library')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContentLibraryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  if (isLoading) return <PageLoading />
  if (error) return (
    <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--color-error)' }}>
      {error}
    </div>
  )

  const allItems = data?.items ?? []
  const afterCategory = categoryFilter
    ? allItems.filter(i => i.category === categoryFilter)
    : allItems
  const filtered = searchQuery
    ? afterCategory.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : afterCategory
  const installedCount = allItems.filter(i => i.isInstalled).length
  const installRate = allItems.length > 0 ? Math.round((installedCount / allItems.length) * 100) : 0

  const handleInstall = async (id: string) => {
    setInstallingId(id)
    try {
      const res = await fetch(`/api/admin/content-library/${id}/install`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Kurulum başarısız')
      toast(json.message ?? 'İçerik kurumunuza eklendi', 'success')
      refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setInstallingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeletingId(target.id)
    try {
      const res = await fetch(`/api/admin/content-library/${target.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Silme başarısız')
      toast(json.message ?? 'İçerik silindi', 'success')
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {showBulkModal && (
        <BulkInstallModal
          items={allItems}
          onClose={() => setShowBulkModal(false)}
          onSuccess={refetch}
        />
      )}

      {showUploadModal && (
        <UploadContentModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={refetch}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          loading={deletingId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Stats + Search + Actions bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke="var(--color-primary)" strokeWidth="3"
                  strokeDasharray={`${installRate} 100`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
              >
                {installRate}%
              </span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {installedCount}/{allItems.length} içerik
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>kurumunuza eklendi</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="İçerik ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', width: '220px' }}
            />
          </div>

          {/* İçerik Yükle */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))' }}
          >
            <Plus className="h-4 w-4" />
            İçerik Yükle
          </button>

          {/* Toplu Ekle */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <Layers className="h-4 w-4" />
            Toplu Ekle
          </button>
        </div>
      </div>

      {/* Kategori Filtreleri */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategoryFilter(null)}
          className="rounded-xl px-4 py-2 text-[11px] font-bold transition-all duration-200"
          style={{
            background: !categoryFilter ? 'var(--color-primary)' : 'var(--color-surface)',
            color: !categoryFilter ? '#fff' : 'var(--color-text-muted)',
            border: `1.5px solid ${!categoryFilter ? 'var(--color-primary)' : 'var(--color-border)'}`,
            boxShadow: !categoryFilter ? '0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
          }}
        >
          Tümü ({allItems.length})
        </button>
        {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
          const count = allItems.filter(i => i.category === key).length
          if (count === 0) return null
          const active = categoryFilter === key
          return (
            <button
              key={key}
              onClick={() => setCategoryFilter(active ? null : key)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold transition-all duration-200"
              style={{
                background: active ? cfg.color : 'var(--color-surface)',
                color: active ? '#fff' : 'var(--color-text-muted)',
                border: `1.5px solid ${active ? cfg.color : 'var(--color-border)'}`,
                boxShadow: active ? `0 4px 12px color-mix(in srgb, ${cfg.color} 25%, transparent)` : 'none',
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: active ? '#fff' : cfg.color }}
              />
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* İçerik Kartları */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onInstall={handleInstall}
              installing={installingId === item.id}
              onDelete={setDeleteTarget}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border py-20 gap-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-bg)' }}>
            {searchQuery ? (
              <Search className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
            ) : (
              <Library className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
              {searchQuery ? `"${searchQuery}" için sonuç bulunamadı`
                : categoryFilter ? 'Bu kategoride içerik bulunamadı'
                  : 'Super Admin tarafından içerik kütüphanesi hazırlandıkça burada görünecek.'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {searchQuery ? 'Farklı bir arama deneyin'
                : categoryFilter ? 'Filtreyi temizleyerek tüm içerikleri görün'
                  : 'Platform yöneticisi içerik eklediğinde burada görünür'}
            </p>
          </div>
          {(categoryFilter || searchQuery) && (
            <button
              onClick={() => { setCategoryFilter(null); setSearchQuery(''); }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <X className="h-3.5 w-3.5" /> Filtreleri Temizle
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────

type ActiveTab = 'platform' | 'my-videos'

export default function AdminContentLibraryPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('platform')

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'platform', label: 'Platform Kütüphanesi', icon: Library, description: 'Hazır eğitim içerikleri' },
    { id: 'my-videos', label: 'Eğitim Videolarım', icon: Film, description: 'Yüklenen videolar' },
  ]

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--color-accent) 4%, transparent) 100%)',
          }}
        />
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-text-primary) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))',
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary) 25%, transparent)',
                }}
              >
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                  İçerik Kütüphanesi
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Platform içerikleri ve yüklenen eğitim videoları
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher — Refined */}
      <div
        className="inline-flex items-center gap-1 rounded-xl p-1"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200"
              style={{
                background: active ? 'var(--color-surface)' : 'transparent',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <Icon className="h-4 w-4" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab İçerikleri */}
      {activeTab === 'platform' && <PlatformLibraryTab />}
      {activeTab === 'my-videos' && <MyVideosTab />}

      {/* Modal animation */}
      <style jsx global>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
