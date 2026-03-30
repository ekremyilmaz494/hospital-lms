'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Library, Clock, Star, CheckCircle2, Plus, Layers, X, ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
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

  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
              <Layers className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
              Toplu Ekle
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-surface-hover)]">
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Bir kategori seçin. O kategorideki tüm aktif içerikler kurumunuza eğitim olarak eklenir.
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Kategori Seç
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={inputStyle}
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
          <div className="mb-4 rounded-xl p-4"
            style={{ background: uninstalledInCategory.length > 0 ? 'var(--color-primary-light)' : 'var(--color-surface-hover)' }}>
            {uninstalledInCategory.length > 0 ? (
              <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                {uninstalledInCategory.length} içerik kurumunuza eklenecek
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Bu kategorideki tüm içerikler zaten eklenmiş.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-secondary)' }}>
            İptal
          </button>
          <button
            onClick={handleInstall}
            disabled={!selectedCategory || loading || uninstalledInCategory.length === 0}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? 'Ekleniyor...' : `${uninstalledInCategory.length} İçerik Ekle`}
          </button>
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
}

function ContentCard({ item, onInstall, installing }: ContentCardProps) {
  const router = useRouter()
  const cat = CONTENT_LIBRARY_CATEGORIES[item.category as ContentLibraryCategoryKey]
  const diff = CONTENT_LIBRARY_DIFFICULTY[item.difficulty as ContentLibraryDifficulty]
  const roleLabels = CONTENT_LIBRARY_TARGET_ROLES.filter(r => item.targetRoles.includes(r.value))

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-lg"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Thumbnail / Gradient Banner */}
      <div className="relative h-32 shrink-0 overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${cat?.color ?? 'var(--color-primary)'}22, ${cat?.color ?? 'var(--color-primary)'}44)` }}
          >
            <Library className="h-10 w-10 opacity-40" style={{ color: cat?.color ?? 'var(--color-primary)' }} />
          </div>
        )}
        {/* Kategori + Zorluk badge overlay */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-sm"
            style={{ background: `${cat?.color ?? 'var(--color-primary)'}dd`, color: '#fff' }}>
            {cat?.label ?? item.category}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm"
            style={{ background: `${diff?.color ?? '#888'}dd`, color: '#fff' }}>
            {diff?.label ?? item.difficulty}
          </span>
        </div>
      </div>

      {/* İçerik */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 font-bold leading-snug" style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
          {item.title}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {item.description}
          </p>
        )}

        {/* Süre + SMG */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
              {item.duration} dk
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              {item.smgPoints} SMG
            </span>
          </div>
        </div>

        {/* Hedef Roller */}
        <div className="flex flex-wrap gap-1">
          {roleLabels.map(r => (
            <span key={r.value} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
              {r.label}
            </span>
          ))}
        </div>

        {/* Eylem butonu */}
        <div className="mt-auto pt-1">
          {item.isInstalled ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 className="h-4 w-4" />
                Eklendi
              </div>
              <button
                onClick={() => router.push('/admin/trainings')}
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--color-primary)' }}
            >
              {installing ? (
                <span>Ekleniyor...</span>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Kuruma Ekle
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────

export default function AdminContentLibraryPage() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useFetch<PageData>('/api/admin/content-library')

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)

  if (isLoading) return <PageLoading />
  if (error) return (
    <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--color-error)' }}>
      {error}
    </div>
  )

  const allItems = data?.items ?? []
  const filtered = categoryFilter
    ? allItems.filter(i => i.category === categoryFilter)
    : allItems

  const installedCount = allItems.filter(i => i.isInstalled).length

  const handleInstall = async (id: string) => {
    setInstallingId(id)
    try {
      const res = await fetch(`/api/admin/content-library/${id}/install`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kurulum başarısız')
      toast(data.message ?? 'İçerik kurumunuza eklendi', 'success')
      refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setInstallingId(null)
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

      <PageHeader
        title="İçerik Kütüphanesi"
        subtitle={`${allItems.length} hazır içerik · ${installedCount} kurumunuza eklendi`}
        secondaryAction={{ label: 'Toplu Ekle', icon: Layers, onClick: () => setShowBulkModal(true) }}
      />

      {/* Kategori Filtreleri */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategoryFilter(null)}
          className="rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors"
          style={{
            background: !categoryFilter ? 'var(--color-primary)' : 'transparent',
            color: !categoryFilter ? '#fff' : 'var(--color-text-muted)',
            border: `1.5px solid ${!categoryFilter ? 'var(--color-primary)' : 'var(--color-border)'}`,
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
              className="rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors"
              style={{
                background: active ? cfg.color : 'transparent',
                color: active ? '#fff' : 'var(--color-text-muted)',
                border: `1.5px solid ${active ? cfg.color : 'var(--color-border)'}`,
              }}
            >
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
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border py-20 gap-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-surface-hover)' }}>
            <Library className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              {categoryFilter ? 'Bu kategoride içerik bulunamadı' : 'Henüz içerik kütüphanesi hazırlanmamış'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {categoryFilter ? 'Filteyi temizleyerek tüm içerikleri görün' : 'Platform yöneticisi içerik eklediğinde burada görünür'}
            </p>
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <X className="h-3.5 w-3.5" /> Filtreyi Temizle
            </button>
          )}
        </div>
      )}
    </div>
  )
}
