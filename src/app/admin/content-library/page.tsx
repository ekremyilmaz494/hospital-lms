'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Library, Clock, Star, CheckCircle2, Plus, Layers, X, ArrowRight,
  Video, ChevronDown, ChevronRight, Film, Play, Sparkles, Search,
  BookOpen, GraduationCap, Folder, BarChart3, Eye,
} from 'lucide-react'
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
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { CategoryIcon } from '@/components/shared/category-icon'

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
}

function ContentCard({ item, onInstall, installing }: ContentCardProps) {
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

        {/* Installed badge */}
        {item.isInstalled && (
          <div className="absolute top-3 right-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md"
              style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
            </div>
          </div>
        )}
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

// ── Eğitim Videoları Tipleri ───────────────────────────────────────────────

interface TrainingVideoItem {
  id: string
  title: string
  durationSeconds: number
  sortOrder: number
  description: string | null
  createdAt: string
}

interface MyTrainingItem {
  id: string
  title: string
  category: string
  publishStatus: string
  videoCount: number
  totalDurationSeconds: number
  createdAt: string
  videos: TrainingVideoItem[]
}

interface MyVideosData {
  trainings: MyTrainingItem[]
}

// ── Süre Formatlama ────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}sa ${m}dk`
  if (m > 0) return s > 0 ? `${m}dk ${s}sn` : `${m}dk`
  return `${s}sn`
}

// ── Video Önizleme Modalı ─────────────────────────────────────────────────

interface VideoPreviewModalProps {
  videoId: string
  videoTitle: string
  trainingTitle: string
  durationSeconds: number
  onClose: () => void
}

function VideoPreviewModal({ videoId, videoTitle, trainingTitle, durationSeconds, onClose }: VideoPreviewModalProps) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider truncate" style={{ color: 'var(--color-text-muted)' }}>{trainingTitle}</p>
            <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{videoTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ background: '#000' }}>
          <video
            src={`/api/stream/${videoId}`}
            controls
            autoPlay
            controlsList="nodownload"
            className="w-full"
            style={{ maxHeight: '60vh' }}
          />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{videoTitle}</span>
          <span className="text-xs font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            {formatDuration(durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Eğitim Video Kartı (Accordion) ────────────────────────────────────────

interface TrainingVideoCardProps {
  item: MyTrainingItem
  isExpanded: boolean
  onToggle: () => void
  onPlayVideo: (v: TrainingVideoItem) => void
}

function TrainingVideoCard({ item, isExpanded, onToggle, onPlayVideo }: TrainingVideoCardProps) {
  const router = useRouter()
  const cat = TRAINING_CATEGORIES.find(c => c.value === item.category)

  const statusStyle =
    item.publishStatus === 'published'
      ? { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'Yayında', dot: 'var(--color-success)' }
      : item.publishStatus === 'draft'
        ? { bg: 'var(--color-surface-hover)', color: 'var(--color-text-muted)', label: 'Taslak', dot: 'var(--color-text-muted)' }
        : { bg: 'var(--color-warning-bg, #fef3c7)', color: 'var(--color-warning, #d97706)', label: 'Arşiv', dot: 'var(--color-warning, #d97706)' }

  return (
    <div
      className="overflow-hidden rounded-2xl border transition-all duration-200"
      style={{
        background: 'var(--color-surface)',
        borderColor: isExpanded ? 'var(--color-primary)' : 'var(--color-border)',
        boxShadow: isExpanded
          ? '0 8px 24px -4px color-mix(in srgb, var(--color-primary) 15%, transparent), 0 0 0 1px var(--color-primary)'
          : 'var(--shadow-sm)',
      }}
    >
      {/* Kart Başlığı */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3.5 p-4 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        {/* Kategori ikonu — larger, with bg */}
        <div
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            background: isExpanded
              ? 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))'
              : 'var(--color-bg)',
            boxShadow: isExpanded ? '0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {isExpanded
          ? <Folder className="h-5 w-5 text-white" />
          : <CategoryIcon name={cat?.icon ?? 'BookOpen'} className="h-5 w-5" style={{ color: cat?.color ?? 'var(--color-primary)' }} />
        }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="flex-1 truncate font-bold font-heading leading-snug"
              style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}
            >
              {item.title}
            </h3>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-transform duration-200"
              style={{
                background: isExpanded ? 'var(--color-primary-light)' : 'transparent',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronDown className="h-3.5 w-3.5" style={{ color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
            </div>
          </div>

          {/* Meta bilgiler */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Status dot + label */}
            <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: statusStyle.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusStyle.dot }} />
              {statusStyle.label}
            </span>

            <span className="text-[10px]" style={{ color: 'var(--color-border)' }}>·</span>

            {/* Kategori */}
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <CategoryIcon name={cat?.icon ?? 'BookOpen'} className="h-3 w-3" style={{ color: cat?.color ?? 'var(--color-text-muted)' }} />
              {cat?.label ?? item.category}
            </span>

            <span className="text-[10px]" style={{ color: 'var(--color-border)' }}>·</span>

            {/* Video + süre */}
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <Film className="h-3 w-3" />
              {item.videoCount} video
            </span>

            <span className="text-[10px]" style={{ color: 'var(--color-border)' }}>·</span>

            <span className="flex items-center gap-1 text-[11px] font-medium tabular-nums" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Clock className="h-3 w-3" />
              {formatDuration(item.totalDurationSeconds)}
            </span>
          </div>
        </div>
      </button>

      {/* Accordion İçeriği — smooth CSS grid animation */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div
            className="border-t transition-opacity duration-300"
            style={{
              borderColor: 'var(--color-border)',
              opacity: isExpanded ? 1 : 0,
            }}
          >
            <div className="p-3 space-y-1">
              {item.videos.map((video, idx) => (
                <div
                  key={video.id}
                  className="group/row flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--color-bg)]"
                  onClick={() => onPlayVideo(video)}
                >
                  {/* Sıra numarası */}
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
                  >
                    {idx + 1}
                  </div>

                  {/* Video ikonu / Play butonu */}
                  <div className="relative h-4 w-4 shrink-0">
                    <Video className="h-4 w-4 transition-opacity group-hover/row:opacity-0" style={{ color: 'var(--color-text-muted)' }} />
                    <Play className="absolute inset-0 h-4 w-4 opacity-0 transition-opacity group-hover/row:opacity-100" style={{ color: 'var(--color-primary)' }} />
                  </div>

                  {/* Başlık */}
                  <span
                    className="flex-1 truncate text-sm font-medium transition-colors group-hover/row:text-[var(--color-primary)]"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {video.title}
                  </span>

                  {/* Play label on hover */}
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wider opacity-0 transition-opacity group-hover/row:opacity-100"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Oynat
                  </span>

                  {/* Süre */}
                  <span
                    className="shrink-0 text-xs font-semibold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                  >
                    {formatDuration(video.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>

            {/* Eğitime Git butonu */}
            <div className="flex justify-end px-4 pb-3">
              <button
                onClick={() => router.push(`/admin/trainings/${item.id}/edit`)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Eğitime Git
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kendi Eğitim Videolarım Sekmesi ────────────────────────────────────────

function MyVideosTab() {
  const { data, isLoading, error } = useFetch<MyVideosData>('/api/admin/content-library/my-videos')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<{
    id: string; title: string; durationSeconds: number; trainingTitle: string
  } | null>(null)

  if (isLoading) return <PageLoading />
  if (error) return (
    <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--color-error)' }}>
      {error}
    </div>
  )

  const allTrainings = data?.trainings ?? []
  const totalVideos = allTrainings.reduce((s, t) => s + t.videoCount, 0)
  const totalDuration = allTrainings.reduce((s, t) => s + t.totalDurationSeconds, 0)
  const publishedCount = allTrainings.filter(t => t.publishStatus === 'published').length

  const filtered = categoryFilter
    ? allTrainings.filter(t => t.category === categoryFilter)
    : allTrainings

  const usedCategories = TRAINING_CATEGORIES.filter(
    cat => allTrainings.some(t => t.category === cat.value)
  )

  return (
    <div className="space-y-5">
      {/* Stats row */}
      {allTrainings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Toplam Eğitim', value: allTrainings.length, icon: GraduationCap, color: 'var(--color-primary)' },
            { label: 'Toplam Video', value: totalVideos, icon: Film, color: 'var(--color-info)' },
            { label: 'Yayında', value: publishedCount, icon: Eye, color: 'var(--color-success)' },
            { label: 'Toplam Süre', value: formatDuration(totalDuration), icon: Clock, color: 'var(--color-accent)' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${stat.color} 10%, transparent)` }}
              >
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold font-heading leading-none" style={{ color: 'var(--color-text-primary)' }}>
                  {stat.value}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

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
          Tümü ({allTrainings.length})
        </button>

        {usedCategories.map(cat => {
          const count = allTrainings.filter(t => t.category === cat.value).length
          const active = categoryFilter === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(active ? null : cat.value)}
              className="rounded-xl px-4 py-2 text-[11px] font-bold transition-all duration-200"
              style={{
                background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                color: active ? '#fff' : 'var(--color-text-muted)',
                border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                boxShadow: active ? '0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)' : 'none',
              }}
            >
              <CategoryIcon name={cat.icon} className="h-3.5 w-3.5" style={{ color: active ? '#fff' : (cat.color ?? 'var(--color-text-muted)') }} />
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Eğitim Kartları */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {filtered.map(item => (
            <TrainingVideoCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onPlayVideo={(v) => setPreviewVideo({ ...v, trainingTitle: item.title })}
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
            <Film className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
              {categoryFilter ? 'Bu kategoride video bulunamadı' : 'İçerik kütüphanesine video yüklemek için "Video Yükle" butonunu kullanın.'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {categoryFilter
                ? 'Filtreyi temizleyerek tümünü görün'
                : 'Yeni eğitim oluştururken video yüklediğinizde burada görünür'
              }
            </p>
          </div>
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" /> Filtreyi Temizle
            </button>
          )}
        </div>
      )}

      {previewVideo && (
        <VideoPreviewModal
          videoId={previewVideo.id}
          videoTitle={previewVideo.title}
          durationSeconds={previewVideo.durationSeconds}
          trainingTitle={previewVideo.trainingTitle}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </div>
  )
}

// ── Platform Kütüphanesi Sekmesi ──────────────────────────────────────────

function PlatformLibraryTab() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useFetch<PageData>('/api/admin/content-library')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
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

  return (
    <div className="space-y-5">
      {showBulkModal && (
        <BulkInstallModal
          items={allItems}
          onClose={() => setShowBulkModal(false)}
          onSuccess={refetch}
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

          {/* Toplu Ekle */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, #000))' }}
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
