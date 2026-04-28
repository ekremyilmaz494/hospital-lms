'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Library, Clock, Star, CheckCircle2, Plus, Layers, X, ArrowRight,
  Film, Sparkles, Search,
  BookOpen, GraduationCap, Upload, AlertCircle, Trash2, ChevronRight,
} from 'lucide-react'
import { generateVideoThumbnail } from '@/lib/video-thumbnail'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useToast } from '@/components/shared/toast'
import { KStatCard } from '@/components/admin/k-stat-card'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
  type ContentLibraryCategoryKey,
  type ContentLibraryDifficulty,
} from '@/lib/content-library-categories'

// ── Klinova Design Tokens (sabit hex'ler — CSS var bypass) ────────────────
const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  BG: '#fafaf9',
  SURFACE_HOVER: '#f5f5f4',
  BORDER: '#c9c4be',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981',
  SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b',
  WARNING_BG: '#fef3c7',
  ERROR: '#ef4444',
  ERROR_BG: '#fee2e2',
  INFO: '#3b82f6',
  INFO_BG: '#dbeafe',
  ACCENT: '#f59e0b',
  VIDEO: '#3b82f6',
  AUDIO: '#f59e0b',
  PDF: '#dc2626',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  SHADOW_HOVER: '0 4px 8px rgba(15, 23, 42, 0.08), 0 16px 40px rgba(15, 23, 42, 0.08)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
} as const

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center"
                style={{ background: K.PRIMARY_LIGHT, borderRadius: 10, color: K.PRIMARY }}
              >
                <Layers size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.2 }}>
                  Toplu İçerik Ekle
                </h2>
                <p style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>Kategori bazlı hızlı kurulum</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: K.TEXT_MUTED }}
              onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }} className="space-y-4">
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED }}>
              Kategori Seç
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                background: K.SURFACE,
                border: `1.5px solid ${K.BORDER}`,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: K.TEXT_PRIMARY,
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
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
              className="flex items-center gap-3"
              style={{
                background: uninstalledInCategory.length > 0 ? K.PRIMARY_LIGHT : K.SURFACE_HOVER,
                border: `1px solid ${uninstalledInCategory.length > 0 ? K.PRIMARY : K.BORDER_LIGHT}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              {uninstalledInCategory.length > 0 ? (
                <>
                  <Sparkles size={16} style={{ color: K.PRIMARY, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: K.PRIMARY }}>
                    {uninstalledInCategory.length} içerik kurumunuza eklenecek
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: K.TEXT_MUTED }}>
                  Bu kategorideki tüm içerikler zaten eklenmiş.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE }}
          >
            İptal
          </button>
          <button
            onClick={handleInstall}
            disabled={!selectedCategory || loading || uninstalledInCategory.length === 0}
            className="flex items-center gap-2"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: !selectedCategory || loading || uninstalledInCategory.length === 0 ? K.TEXT_MUTED : K.PRIMARY,
              border: 'none',
              borderRadius: 10,
              cursor: !selectedCategory || loading || uninstalledInCategory.length === 0 ? 'not-allowed' : 'pointer',
              opacity: !selectedCategory || loading || uninstalledInCategory.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY_HOVER }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY }}
          >
            <Plus size={14} />
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
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 16px' }} className="flex items-start gap-4">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: 44, height: 44, background: K.ERROR_BG, borderRadius: 12, color: K.ERROR }}
          >
            <AlertCircle size={22} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.3 }}>
              İçeriği silmek istediğinize emin misiniz?
            </h3>
            <p style={{ marginTop: 6, fontSize: 13, color: K.TEXT_SECONDARY, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>&ldquo;{item.title}&rdquo;</span>{' '}
              kalıcı olarak silinecek. Depolamadaki dosyalar da kaldırılacak.
            </p>
            <p style={{ marginTop: 8, fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
              Eğer bu içerik bir eğitimde kullanılıyorsa silme reddedilecek — önce ilgili eğitimi silmelisiniz.
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2"
          style={{ padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = K.SURFACE }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: K.ERROR,
              border: 'none',
              borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Trash2 size={14} />
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
  const catColor = cat?.color ?? K.PRIMARY

  return (
    <div
      className="group relative flex flex-col overflow-hidden"
      style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14,
        boxShadow: K.SHADOW_CARD,
        transition: 'border-color 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = K.SHADOW_HOVER
        e.currentTarget.style.borderColor = K.PRIMARY
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = K.SHADOW_CARD
        e.currentTarget.style.borderColor = K.BORDER
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail / Banner — 16:9 */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', flexShrink: 0, background: K.BG }}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${catColor}14, ${catColor}28)` }}
          >
            <Library size={42} strokeWidth={1.25} style={{ color: catColor, opacity: 0.4 }} />
          </div>
        )}

        {/* Bottom badges */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              background: catColor,
              borderRadius: 999,
              letterSpacing: '0.02em',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            }}
          >
            {cat?.label ?? item.category}
          </span>
          {diff && (
            <span
              style={{
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: diff.color,
                borderRadius: 999,
                letterSpacing: '0.02em',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
              }}
            >
              {diff.label}
            </span>
          )}
        </div>

        {/* Top-right actions */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
          {item.isOwned && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(item) }}
              disabled={deleting}
              title="İçeriği sil"
              aria-label="İçeriği sil"
              className="flex items-center justify-center opacity-0 group-hover:opacity-100"
              style={{
                width: 30,
                height: 30,
                color: K.TEXT_SECONDARY,
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(6px)',
                border: `1px solid ${K.BORDER}`,
                borderRadius: 8,
                cursor: deleting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
                transition: 'opacity 160ms ease, color 160ms ease, border-color 160ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = K.ERROR; e.currentTarget.style.borderColor = K.ERROR }}
              onMouseLeave={(e) => { e.currentTarget.style.color = K.TEXT_SECONDARY; e.currentTarget.style.borderColor = K.BORDER }}
            >
              <Trash2 size={14} />
            </button>
          )}
          {item.isInstalled && (
            <div
              className="flex items-center justify-center"
              style={{ width: 30, height: 30, background: K.SURFACE, borderRadius: 999, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
            >
              <CheckCircle2 size={16} style={{ color: K.SUCCESS }} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3" style={{ padding: 16 }}>
        <h3
          className="line-clamp-2"
          style={{ fontFamily: K.FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.35, letterSpacing: '-0.01em' }}
        >
          {item.title}
        </h3>
        {item.description && (
          <p className="line-clamp-2" style={{ fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
            {item.description}
          </p>
        )}

        {/* Stats bar */}
        <div
          className="flex items-center gap-3"
          style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 10, padding: '8px 12px' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock size={13} style={{ color: K.TEXT_MUTED }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: K.TEXT_SECONDARY }}>
              {item.duration} dk
            </span>
          </div>
          <div style={{ width: 1, height: 12, background: K.BORDER }} />
          <div className="flex items-center gap-1.5">
            <Star size={13} style={{ color: K.ACCENT }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: K.ACCENT }}>
              {item.smgPoints} SMG
            </span>
          </div>
        </div>

        {/* Target roles */}
        {roleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {roleLabels.map(r => (
              <span
                key={r.value}
                style={{
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: K.TEXT_SECONDARY,
                  background: K.SURFACE_HOVER,
                  border: `1px solid ${K.BORDER_LIGHT}`,
                  borderRadius: 999,
                }}
              >
                {r.label}
              </span>
            ))}
          </div>
        )}

        {/* Action */}
        <div className="mt-auto pt-1">
          {item.isInstalled ? (
            <div className="flex items-center gap-2">
              <div
                className="flex flex-1 items-center justify-center gap-2"
                style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, background: K.SUCCESS_BG, color: K.SUCCESS, borderRadius: 10 }}
              >
                <CheckCircle2 size={14} />
                Eğitimde
              </div>
              <button
                onClick={() => router.push('/admin/trainings')}
                className="flex items-center gap-1"
                style={{
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: K.TEXT_SECONDARY,
                  background: K.SURFACE,
                  border: `1.5px solid ${K.BORDER}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER; e.currentTarget.style.borderColor = K.PRIMARY }}
                onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE; e.currentTarget.style.borderColor = K.BORDER }}
              >
                <ArrowRight size={13} />
                Git
              </button>
            </div>
          ) : (
            <button
              onClick={() => onInstall(item.id)}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2"
              style={{
                padding: '10px 0',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: K.PRIMARY,
                border: 'none',
                borderRadius: 10,
                cursor: installing ? 'not-allowed' : 'pointer',
                opacity: installing ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (!installing) e.currentTarget.style.background = K.PRIMARY_HOVER }}
              onMouseLeave={(e) => { if (!installing) e.currentTarget.style.background = K.PRIMARY }}
            >
              {installing ? (
                <span>Ekleniyor...</span>
              ) : (
                <>
                  <GraduationCap size={14} />
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
    <div className="flex h-64 items-center justify-center" style={{ fontSize: 13, color: K.ERROR }}>
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
      {/* Section header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: K.TEXT_PRIMARY, letterSpacing: '-0.018em' }}>
            Eğitim Videolarım
          </h2>
          <p style={{ marginTop: 4, fontSize: 13, color: K.TEXT_MUTED }}>
            Kurumunuzun eğitimlerinde kullanılan içerikler — {allItems.length} öğe · {linkedTrainingIds.size} eğitime bağlı · {totalDurationMin}dk
          </p>
        </div>
      </div>

      {/* KPI bar */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KStatCard title="Toplam İçerik" value={allItems.length} icon={Library} accentColor={K.PRIMARY} />
          <KStatCard title="Eğitime Bağlı" value={linkedTrainingIds.size} icon={GraduationCap} accentColor={K.INFO} />
          <KStatCard title="Toplam Süre" value={`${totalDurationMin}dk`} icon={Clock} accentColor={K.WARNING} />
          <KStatCard title="SMG Puanı" value={totalSmg} icon={Star} accentColor={K.ACCENT} />
        </div>
      )}

      {/* Search */}
      {allItems.length > 0 && (
        <div className="flex items-center justify-end">
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: K.TEXT_MUTED }} />
            <input
              type="text"
              placeholder="İçerik ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                padding: '0 12px 0 38px',
                fontSize: 13,
                background: K.SURFACE,
                border: `1.5px solid ${K.BORDER}`,
                borderRadius: 10,
                color: K.TEXT_PRIMARY,
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>
      )}

      {/* Category filter pills */}
      {allItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={!categoryFilter}
            onClick={() => setCategoryFilter(null)}
            label={`Tümü (${allItems.length})`}
          />
          {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
            const count = allItems.filter(i => i.category === key).length
            if (count === 0) return null
            const active = categoryFilter === key
            return (
              <FilterPill
                key={key}
                active={active}
                onClick={() => setCategoryFilter(active ? null : key)}
                label={`${cfg.label} (${count})`}
                color={cfg.color}
              />
            )
          })}
        </div>
      )}

      {/* Cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(item => (
            <MyVideoCard
              key={item.id}
              item={item}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={searchQuery ? Search : Film}
          title={
            searchQuery
              ? `"${searchQuery}" için sonuç bulunamadı`
              : categoryFilter
                ? 'Bu kategoride kullanılan içerik yok'
                : 'Henüz bir eğitime bağlanmış içerik yok'
          }
          description={
            searchQuery
              ? 'Farklı bir arama deneyin'
              : categoryFilter
                ? 'Filtreyi temizleyerek tümünü görün'
                : "Platform Kütüphanesi'nden bir içeriği eğitim olarak atadığınızda burada görünür"
          }
          action={(categoryFilter || searchQuery) ? {
            label: 'Filtreleri Temizle',
            onClick: () => { setCategoryFilter(null); setSearchQuery('') },
          } : undefined}
        />
      )}
    </div>
  )
}

// ── Reusable Filter Pill ──────────────────────────────────────────────────

interface FilterPillProps {
  active: boolean
  onClick: () => void
  label: string
  color?: string
}

function FilterPill({ active, onClick, label, color }: FilterPillProps) {
  const accent = color ?? K.PRIMARY
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        background: active ? accent : K.SURFACE,
        color: active ? '#fff' : K.TEXT_SECONDARY,
        border: `1.5px solid ${active ? accent : K.BORDER}`,
        cursor: 'pointer',
        transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = K.SURFACE_HOVER; e.currentTarget.style.borderColor = accent } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = K.SURFACE; e.currentTarget.style.borderColor = K.BORDER } }}
    >
      {!active && color && (
        <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      )}
      {label}
    </button>
  )
}

// ── Reusable Empty State ──────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14,
        padding: '64px 24px',
        gap: 16,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: 56, height: 56, background: K.BG, border: `1.5px solid ${K.BORDER_LIGHT}`, borderRadius: 14, color: K.TEXT_MUTED }}
      >
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <div>
        <p style={{ fontFamily: K.FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: K.TEXT_PRIMARY }}>{title}</p>
        <p style={{ marginTop: 4, fontSize: 12, color: K.TEXT_MUTED }}>{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5"
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: K.TEXT_SECONDARY,
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            borderRadius: 10,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
          onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE }}
        >
          <X size={13} /> {action.label}
        </button>
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
}

function MyVideoCard({ item }: MyVideoCardProps) {
  const cat = CONTENT_LIBRARY_CATEGORIES[item.category as ContentLibraryCategoryKey]
  const diff = CONTENT_LIBRARY_DIFFICULTY[item.difficulty as ContentLibraryDifficulty]
  const catColor = cat?.color ?? K.PRIMARY
  const primaryTraining = item.usedInTrainings[0]

  return (
    <div
      className="group relative flex flex-col overflow-hidden"
      style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14,
        boxShadow: K.SHADOW_CARD,
        transition: 'border-color 200ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = K.SHADOW_HOVER
        e.currentTarget.style.borderColor = K.PRIMARY
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = K.SHADOW_CARD
        e.currentTarget.style.borderColor = K.BORDER
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail — 16:9 */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', flexShrink: 0, background: K.BG }}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${catColor}14, ${catColor}28)` }}
          >
            <Library size={42} strokeWidth={1.25} style={{ color: catColor, opacity: 0.4 }} />
          </div>
        )}

        {/* Bottom badges */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              background: catColor,
              borderRadius: 999,
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            }}
          >
            {cat?.label ?? item.category}
          </span>
          {diff && (
            <span
              style={{
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: diff.color,
                borderRadius: 999,
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
              }}
            >
              {diff.label}
            </span>
          )}
        </div>

        {/* Usage badge — top-right */}
        <div className="absolute top-2.5 right-2.5">
          <div
            className="flex items-center gap-1"
            style={{
              padding: '4px 10px',
              background: K.SURFACE,
              borderRadius: 999,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              border: `1px solid ${K.SUCCESS_BG}`,
            }}
          >
            <GraduationCap size={12} style={{ color: K.SUCCESS }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: K.SUCCESS }}>
              Eğitimde {item.usageCount}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3" style={{ padding: 16 }}>
        <h3
          className="line-clamp-2"
          style={{ fontFamily: K.FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.35, letterSpacing: '-0.01em' }}
        >
          {item.title}
        </h3>
        {item.description && (
          <p className="line-clamp-2" style={{ fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
            {item.description}
          </p>
        )}

        {/* Stats */}
        <div
          className="flex items-center gap-3"
          style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 10, padding: '8px 12px' }}
        >
          <div className="flex items-center gap-1.5">
            <Clock size={13} style={{ color: K.TEXT_MUTED }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: K.TEXT_SECONDARY }}>
              {item.duration} dk
            </span>
          </div>
          <div style={{ width: 1, height: 12, background: K.BORDER }} />
          <div className="flex items-center gap-1.5">
            <Star size={13} style={{ color: K.ACCENT }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: K.ACCENT }}>
              {item.smgPoints} SMG
            </span>
          </div>
        </div>

        {/* Linked training — sadece bilgi etiketi, tıklanabilir değil */}
        {primaryTraining && (
          <div className="mt-auto pt-1">
            <span
              className="flex w-full items-center gap-2"
              title={
                item.usageCount > 1
                  ? `Atandığı eğitimler: ${primaryTraining.title} ve ${item.usageCount - 1} diğeri`
                  : `Atandığı eğitim: ${primaryTraining.title}`
              }
              style={{
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: K.PRIMARY,
                background: K.PRIMARY_LIGHT,
                border: `1.5px solid ${K.PRIMARY}`,
                borderRadius: 10,
              }}
            >
              <GraduationCap size={13} style={{ color: K.PRIMARY, flexShrink: 0 }} />
              <span className="truncate">
                {item.usageCount > 1
                  ? `${primaryTraining.title} +${item.usageCount - 1}`
                  : primaryTraining.title}
              </span>
            </span>
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

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: K.TEXT_PRIMARY,
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: K.TEXT_MUTED,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${K.BORDER_LIGHT}`, position: 'sticky', top: 0, background: K.SURFACE, zIndex: 1 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, background: K.PRIMARY_LIGHT, borderRadius: 10, color: K.PRIMARY }}
            >
              <Upload size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY }}>
                İçerik Yükle
              </h2>
              <p style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>Video, PDF veya ses dosyası</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: K.TEXT_MUTED, opacity: uploading ? 0.5 : 1 }}
            onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }} className="space-y-4">
          {/* Drop zone */}
          <div>
            <label style={labelStyle}>
              Dosya <span style={{ color: K.ERROR }}>*</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2"
              style={{
                background: selectedFiles.length > 0 ? K.PRIMARY_LIGHT : K.BG,
                border: `2px dashed ${selectedFiles.length > 0 ? K.PRIMARY : K.BORDER}`,
                borderRadius: 14,
                padding: '36px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: selectedFiles.length > 0 ? K.PRIMARY : K.TEXT_SECONDARY,
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.5 : 1,
                transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (uploading) return
                e.currentTarget.style.background = K.PRIMARY_LIGHT
                e.currentTarget.style.borderColor = K.PRIMARY
                e.currentTarget.style.color = K.PRIMARY
              }}
              onMouseLeave={(e) => {
                if (uploading || selectedFiles.length > 0) return
                e.currentTarget.style.background = K.BG
                e.currentTarget.style.borderColor = K.BORDER
                e.currentTarget.style.color = K.TEXT_SECONDARY
              }}
            >
              <Upload size={26} strokeWidth={1.5} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} dosya seçildi`
                  : 'Buraya bırakın veya tıklayın'}
              </span>
              <span style={{ fontSize: 11, color: K.TEXT_MUTED }}>video · ses · PDF · pptx</span>
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
              <ul style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedFiles.map(f => (
                  <li
                    key={f.name}
                    className="flex items-center gap-2"
                    style={{ fontSize: 12, color: K.TEXT_SECONDARY, padding: '4px 8px', background: K.BG, borderRadius: 6 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: K.PRIMARY, flexShrink: 0 }} />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>
              Başlık <span style={{ color: K.ERROR }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Örn. Enfeksiyon Kontrolü Eğitimi"
              style={inputBaseStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>
              Kategori <span style={{ color: K.ERROR }}>*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={uploading}
              style={{ ...inputBaseStyle, fontWeight: 500 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            >
              <option value="">Kategori seçin...</option>
              {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>
              Açıklama <span style={{ color: K.TEXT_MUTED, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(opsiyonel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={uploading}
              rows={2}
              style={{ ...inputBaseStyle, resize: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Advanced */}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: K.TEXT_SECONDARY, padding: '6px 0' }}>
              Gelişmiş seçenekler (opsiyonel)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label style={labelStyle}>Zorluk</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  disabled={uploading}
                  style={{ ...inputBaseStyle, fontWeight: 500 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
                >
                  {Object.entries(CONTENT_LIBRARY_DIFFICULTY).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Hedef Roller</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_LIBRARY_TARGET_ROLES.map(r => {
                    const active = targetRoles.includes(r.value)
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRole(r.value)}
                        disabled={uploading}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: active ? '#fff' : K.TEXT_SECONDARY,
                          background: active ? K.PRIMARY : K.SURFACE,
                          border: `1.5px solid ${active ? K.PRIMARY : K.BORDER}`,
                          borderRadius: 999,
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          opacity: uploading ? 0.5 : 1,
                        }}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>SMG Puanı</label>
                <input
                  type="number"
                  min={0}
                  value={smgPoints}
                  onChange={e => setSmgPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={uploading}
                  placeholder="0"
                  style={inputBaseStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </details>

          {/* Progress */}
          {Object.keys(progress).length > 0 && (
            <div
              className="space-y-2"
              style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 12, padding: 12 }}
            >
              {Object.values(progress).map(p => {
                const pct = p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0
                const pctColor =
                  p.status === 'error' ? K.ERROR
                    : p.status === 'done' ? K.SUCCESS
                      : K.PRIMARY
                return (
                  <div key={p.fileName} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate" style={{ fontSize: 12, color: K.TEXT_PRIMARY }}>
                        {p.status === 'error' && <AlertCircle size={13} style={{ color: K.ERROR, flexShrink: 0 }} />}
                        {p.status === 'done' && <CheckCircle2 size={13} style={{ color: K.SUCCESS, flexShrink: 0 }} />}
                        <span className="truncate">{p.fileName}</span>
                      </span>
                      <span
                        style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: pctColor, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.status === 'error' ? 'HATA' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 4, overflow: 'hidden', borderRadius: 999, background: K.BORDER_LIGHT }}>
                      <div
                        style={{ height: '100%', width: `${pct}%`, background: pctColor, transition: 'width 200ms ease' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2"
          style={{ padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG, position: 'sticky', bottom: 0 }}
        >
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE }}
          >
            İptal
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0 || !title.trim() || !category}
            className="flex items-center gap-2"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: K.PRIMARY,
              border: 'none',
              borderRadius: 10,
              cursor: (uploading || selectedFiles.length === 0 || !title.trim() || !category) ? 'not-allowed' : 'pointer',
              opacity: (uploading || selectedFiles.length === 0 || !title.trim() || !category) ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY_HOVER }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY }}
          >
            <Upload size={14} />
            {uploading ? 'Yükleniyor...' : 'Yükle'}
          </button>
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
    <div className="flex h-64 items-center justify-center" style={{ fontSize: 13, color: K.ERROR }}>
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
  const totalDurationMin = allItems.reduce((s, i) => s + i.duration, 0)
  const totalSmg = allItems.reduce((s, i) => s + i.smgPoints, 0)

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

      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: K.TEXT_PRIMARY, letterSpacing: '-0.018em' }}>
            Platform Kütüphanesi
          </h2>
          <p style={{ marginTop: 4, fontSize: 13, color: K.TEXT_MUTED }}>
            Hazır eğitim içerikleri — kuruma eklediğiniz oran <strong style={{ color: K.PRIMARY, fontWeight: 700 }}>%{installRate}</strong> ({installedCount}/{allItems.length})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER; e.currentTarget.style.borderColor = K.PRIMARY }}
            onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE; e.currentTarget.style.borderColor = K.BORDER }}
          >
            <Layers size={15} />
            Toplu Ekle
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: K.PRIMARY,
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.PRIMARY_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = K.PRIMARY }}
          >
            <Plus size={15} />
            Yeni İçerik Yükle
          </button>
        </div>
      </div>

      {/* KPI bar */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KStatCard title="Toplam İçerik" value={allItems.length} icon={Library} accentColor={K.PRIMARY} />
          <KStatCard title="Eğitimde" value={installedCount} icon={GraduationCap} accentColor={K.INFO} />
          <KStatCard title="Toplam Süre" value={`${totalDurationMin}dk`} icon={Clock} accentColor={K.WARNING} />
          <KStatCard title="SMG Puanı" value={totalSmg} icon={Star} accentColor={K.ACCENT} />
        </div>
      )}

      {/* Search */}
      <div className="flex items-center justify-end">
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: K.TEXT_MUTED }} />
          <input
            type="text"
            placeholder="İçerik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px 0 38px',
              fontSize: 13,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              color: K.TEXT_PRIMARY,
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
            onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={!categoryFilter}
          onClick={() => setCategoryFilter(null)}
          label={`Tümü (${allItems.length})`}
        />
        {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
          const count = allItems.filter(i => i.category === key).length
          if (count === 0) return null
          const active = categoryFilter === key
          return (
            <FilterPill
              key={key}
              active={active}
              onClick={() => setCategoryFilter(active ? null : key)}
              label={`${cfg.label} (${count})`}
              color={cfg.color}
            />
          )
        })}
      </div>

      {/* Cards */}
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
        <EmptyState
          icon={searchQuery ? Search : Library}
          title={
            searchQuery
              ? `"${searchQuery}" için sonuç bulunamadı`
              : categoryFilter
                ? 'Bu kategoride içerik bulunamadı'
                : 'Super Admin tarafından içerik kütüphanesi hazırlandıkça burada görünecek.'
          }
          description={
            searchQuery
              ? 'Farklı bir arama deneyin'
              : categoryFilter
                ? 'Filtreyi temizleyerek tüm içerikleri görün'
                : 'Platform yöneticisi içerik eklediğinde burada görünür'
          }
          action={(categoryFilter || searchQuery) ? {
            label: 'Filtreleri Temizle',
            onClick: () => { setCategoryFilter(null); setSearchQuery('') },
          } : undefined}
        />
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
    <div className="k-page space-y-6">
      {/* Page header */}
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">İçerik Kütüphanesi</span>
          </div>
          <h1 className="k-page-title">İçerik Kütüphanesi</h1>
          <p className="k-page-subtitle">Platform içerikleri ve kuruma yüklediğiniz eğitim videoları</p>
        </div>
        <div
          className="flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: K.PRIMARY_LIGHT,
            color: K.PRIMARY,
            flexShrink: 0,
          }}
        >
          <BookOpen size={22} strokeWidth={1.75} />
        </div>
      </header>

      {/* Tab switcher (segmented pill) */}
      <div
        className="inline-flex items-center"
        style={{
          background: K.BG,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 12,
          padding: 4,
          gap: 2,
        }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2"
              style={{
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                background: active ? K.SURFACE : 'transparent',
                color: active ? K.TEXT_PRIMARY : K.TEXT_MUTED,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                transition: 'background 160ms ease, color 160ms ease, box-shadow 160ms ease',
              }}
            >
              <Icon size={15} strokeWidth={1.75} style={{ color: active ? K.PRIMARY : K.TEXT_MUTED }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'platform' && <PlatformLibraryTab />}
      {activeTab === 'my-videos' && <MyVideosTab />}

      {/* Modal animation */}
      <style jsx global>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
