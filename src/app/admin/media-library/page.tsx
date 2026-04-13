'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Upload, Search, Trash2, FileText, Music, Video,
  Edit2, X, Play, Plus, ArrowRight, TrendingUp, HardDrive,
  BadgeCheck, Clock, AlertCircle, SlidersHorizontal, ArrowUpDown,
  Film,
} from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useToast } from '@/components/shared/toast'
import { generateVideoThumbnail } from '@/lib/video-thumbnail'

interface UploadState {
  loaded: number
  total: number
  startedAt: number
  status: 'uploading' | 'done' | 'error'
}

interface MediaItem {
  id: string
  title: string
  description: string | null
  category: string
  contentType: string | null
  fileType: string | null
  s3Key: string | null
  duration: number
  thumbnailUrl: string | null
  createdAt: string
  usageCount: number
}

interface MediaListResponse {
  items: MediaItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface StatsResponse {
  totalAssets: number
  videoCount: number
  audioCount: number
  pdfCount: number
  storageBytes: number
  storageEstimated: boolean
  trend30d: { pct: number; isPositive: boolean }
  recent7d: number
}

const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024 * 1024 // 5 TB

const TYPE_META: Record<string, { label: string; glyph: string; icon: typeof Video }> = {
  video: { label: 'Video', glyph: 'VID', icon: Video },
  pdf:   { label: 'Belge', glyph: 'DOC', icon: FileText },
  audio: { label: 'Ses',   glyph: 'AUD', icon: Music },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.ceil(seconds)}sn`
  const m = Math.floor(seconds / 60)
  const s = Math.ceil(seconds % 60)
  return `${m}dk ${s}sn`
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—'
  if (minutes < 60) return `${minutes}dk`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}s ${m}dk`
}

export default function MediaLibraryPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')
  const [page, setPage] = useState(1)
  const [recentOnly, setRecentOnly] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadState>>({})
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Search'i debounce et — her karakterde API'ye gitmesin
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const queryParams = new URLSearchParams({ page: String(page), limit: '24' })
  if (debouncedSearch) queryParams.set('search', debouncedSearch)
  if (contentTypeFilter) queryParams.set('contentType', contentTypeFilter)

  const { data, isLoading, error, refetch } = useFetch<MediaListResponse>(
    `/api/admin/media-library?${queryParams}`,
  )
  const { data: stats, refetch: refetchStats } = useFetch<StatsResponse>(
    '/api/admin/media-library/stats',
  )

  const rawItems = data?.items ?? []
  const items = useMemo(() => {
    let list = rawItems
    if (recentOnly) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      list = list.filter(i => new Date(i.createdAt).getTime() >= sevenDaysAgo)
    }
    if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'tr'))
    }
    return list
  }, [rawItems, recentOnly, sortBy])

  const totalPages = data?.totalPages ?? 1

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadProgress({})
    setUploading(true)

    const fileArray = Array.from(files).slice(0, 20)

    const payload = fileArray.map(f => ({
      fileName: f.name,
      contentType: f.type,
      title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }))

    try {
      const res = await fetch('/api/admin/media-library', {
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

      const { results } = await res.json() as { results: Array<{ id?: string; uploadUrl?: string; thumbnailUploadUrl?: string | null; fileName: string; error?: string }> }

      const uploads = results
        .filter((r): r is { id: string; uploadUrl: string; thumbnailUploadUrl?: string | null; fileName: string } => !!r.uploadUrl && !!r.id)
        .map((result) => {
          const file = fileArray.find(f => f.name === result.fileName)
          if (!file) return Promise.resolve({ ok: false, id: result.id, fileName: result.fileName })

          const startedAt = Date.now()
          setUploadProgress(prev => ({
            ...prev,
            [result.fileName]: { loaded: 0, total: file.size, startedAt, status: 'uploading' },
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

          return new Promise<{ ok: boolean; id: string; fileName: string }>((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setUploadProgress(prev => ({
                  ...prev,
                  [result.fileName]: { loaded: e.loaded, total: e.total, startedAt, status: 'uploading' },
                }))
              }
            }
            xhr.onload = () => {
              const ok = xhr.status >= 200 && xhr.status < 300
              setUploadProgress(prev => ({
                ...prev,
                [result.fileName]: { loaded: file.size, total: file.size, startedAt, status: ok ? 'done' : 'error' },
              }))
              resolve({ ok, id: result.id, fileName: result.fileName })
            }
            xhr.onerror = () => {
              setUploadProgress(prev => ({
                ...prev,
                [result.fileName]: { loaded: 0, total: file.size, startedAt, status: 'error' },
              }))
              resolve({ ok: false, id: result.id, fileName: result.fileName })
            }
            xhr.open('PUT', result.uploadUrl)
            xhr.setRequestHeader('Content-Type', file.type)
            xhr.send(file)
          })
        })

      const uploadResults = await Promise.all(uploads)
      const succeeded = uploadResults.filter(r => r.ok)
      const failed = uploadResults.filter(r => !r.ok)

      await Promise.all(
        failed.map(f => fetch(`/api/admin/media-library/${f.id}`, { method: 'DELETE' }).catch(() => {}))
      )

      if (succeeded.length > 0 && failed.length === 0) {
        toast(`${succeeded.length} dosya yüklendi`, 'success')
      } else if (succeeded.length > 0 && failed.length > 0) {
        toast(`${succeeded.length} yüklendi, ${failed.length} başarısız`, 'error')
      } else {
        toast(`${failed.map(f => f.fileName).join(', ')} yüklenemedi`, 'error')
      }

      refetch()
      refetchStats()
      setTimeout(() => {
        setUploadProgress(prev => {
          const next: Record<string, UploadState> = {}
          for (const [k, v] of Object.entries(prev)) {
            if (v.status === 'error') next[k] = v
          }
          return next
        })
      }, 3000)
    } catch {
      toast('Yükleme sırasında bir hata oluştu', 'error')
    } finally {
      setUploading(false)
    }
  }, [toast, refetch, refetchStats])

  const handleDelete = useCallback(async (item: MediaItem) => {
    if (!confirm(`"${item.title}" silinecek. Emin misiniz?`)) return

    const res = await fetch(`/api/admin/media-library/${item.id}`, { method: 'DELETE' })
    const resData = await res.json()

    if (!res.ok) {
      toast(resData.error || 'Silinemedi', 'error')
      return
    }

    toast(`"${item.title}" medya kütüphanesinden kaldırıldı`, 'success')
    refetch()
    refetchStats()
  }, [toast, refetch, refetchStats])

  const handleRename = useCallback(async () => {
    if (!editingItem || !editTitle.trim()) return

    await fetch(`/api/admin/media-library/${editingItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() }),
    })

    setEditingItem(null)
    refetch()
  }, [editingItem, editTitle, refetch])

  const handlePreview = useCallback(async (item: MediaItem) => {
    setPreviewItem(item)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/admin/media-library/${item.id}`)
      if (!res.ok) {
        toast('Önizleme URL alınamadı', 'error')
        setPreviewItem(null)
        return
      }
      const resData = await res.json() as { url: string }

      if (item.contentType === 'pdf') {
        const fileRes = await fetch(resData.url)
        if (!fileRes.ok) throw new Error('PDF indirilemedi')
        const blob = await fileRes.blob()
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        setPreviewUrl(URL.createObjectURL(pdfBlob))
      } else {
        setPreviewUrl(resData.url)
      }
    } catch {
      toast('Önizleme yüklenemedi', 'error')
      setPreviewItem(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [toast])

  const closePreview = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewItem(null)
    setPreviewUrl(null)
  }, [previewUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const hasEverLoadedRef = useRef(false)
  if (data) hasEverLoadedRef.current = true

  if (isLoading && !hasEverLoadedRef.current) return <PageLoading />
  if (error && !hasEverLoadedRef.current) return <div className="p-8 text-center" style={{ color: 'var(--color-error)' }}>Medya kütüphanesi yüklenemedi</div>

  const storagePct = stats ? Math.min(100, (stats.storageBytes / STORAGE_QUOTA_BYTES) * 100) : 0

  return (
    <div className="space-y-8 pb-16">
      {/* ═══════════════ HERO ROW ═══════════════ */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
            <BadgeCheck className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
            Klinik Arşiv
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            Medya Kütüphanesi
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Yüksek hassasiyetli klinik eğitim varlıklarınızı oluşturun ve yönetin. Tüm medya,
            doğruluk ve erişilebilirlik açısından titiz bir doğrulama sürecinden geçer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(s => s === 'date' ? 'title' : 'date')}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-[background-color,border-color] duration-200"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === 'date' ? 'Tarihe Göre' : 'Başlığa Göre'}
          </button>
          <button
            onClick={() => { setContentTypeFilter(''); setRecentOnly(false); setSearch('') }}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-[background-color,border-color] duration-200"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtrele
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))',
              boxShadow: '0 8px 20px var(--color-primary-light, rgba(13,150,104,0.3))',
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Yükleniyor...' : 'Yeni Yükle'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*,.pdf,.pptx"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {/* ═══════════════ WIDGET ROW ═══════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Storage Used */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                Depolama Kullanımı
              </span>
            </div>
            {stats?.storageEstimated && (
              <span className="font-mono text-[9px] uppercase" style={{ color: 'var(--color-text-muted)' }}>~tahmini</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              {stats ? formatBytes(stats.storageBytes) : '—'}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>/ 5 TB</span>
          </div>
          <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${storagePct}%`,
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary))',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            <span>{storagePct.toFixed(1)}% doldu</span>
            <span>{formatBytes(Math.max(0, STORAGE_QUOTA_BYTES - (stats?.storageBytes ?? 0)))} boş</span>
          </div>
        </div>

        {/* Total Assets */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                Toplam Varlık
              </span>
            </div>
            {stats && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: stats.trend30d.isPositive ? 'var(--color-primary-light, rgba(13,150,104,0.12))' : 'var(--color-error-bg, rgba(239,68,68,0.12))',
                  color: stats.trend30d.isPositive ? 'var(--color-primary)' : 'var(--color-error)',
                }}
              >
                <TrendingUp className="h-2.5 w-2.5" />
                {stats.trend30d.isPositive ? '+' : '-'}{stats.trend30d.pct.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              {stats ? stats.totalAssets.toLocaleString('tr-TR') : '—'}
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            {[
              { label: 'Video', count: stats?.videoCount ?? 0, icon: Video },
              { label: 'Belge', count: stats?.pdfCount ?? 0, icon: FileText },
              { label: 'Ses', count: stats?.audioCount ?? 0, icon: Music },
            ].map((t) => {
              const TIcon = t.icon
              return (
                <div key={t.label} className="flex-1 flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: 'var(--color-primary-light, rgba(13,150,104,0.08))' }}
                  >
                    <TIcon className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t.label}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{t.count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Verification Queue — AMBER CTA */}
        <button
          onClick={() => { setRecentOnly(!recentOnly); setPage(1) }}
          className="group relative rounded-2xl p-6 text-left overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-1"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent), #d97706)',
            boxShadow: '0 10px 30px rgba(245, 158, 11, 0.25)',
          }}
        >
          <div
            className="absolute top-0 right-0 h-32 w-32 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', transform: 'translate(30%, -30%)' }}
          />
          <div
            className="absolute bottom-0 left-0 h-24 w-24 rounded-full"
            style={{ background: 'rgba(0,0,0,0.08)', transform: 'translate(-30%, 30%)' }}
          />

          <div className="relative">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-white/90" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                  Doğrulama Sırası
                </span>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-[transform] duration-200 group-hover:scale-110 group-hover:rotate-12">
                <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {stats ? String(stats.recent7d).padStart(2, '0') : '—'}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/80">Son 7 günde yüklenen</p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5" style={{ color: 'var(--color-accent)' }}>
              {recentOnly ? 'Filtreyi Kaldır' : 'Sırayı İncele'}
              <ArrowRight className="h-3 w-3 transition-[transform] duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>
        </button>
      </div>

      {/* ═══════════════ SEARCH + TAB PILLS ═══════════════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Medya kütüphanesinde ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl pl-11 pr-10 py-2.5 text-sm focus:outline-none transition-[border-color,box-shadow] duration-200"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Aramayı temizle"
            >
              <X className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {[
            { value: '', label: 'Tüm Varlıklar', glyph: 'ALL' },
            { value: 'video', label: 'Video', glyph: 'VID' },
            { value: 'pdf', label: 'Belge', glyph: 'DOC' },
            { value: 'audio', label: 'Ses', glyph: 'AUD' },
          ].map((opt) => {
            const active = contentTypeFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => { setContentTypeFilter(opt.value); setPage(1) }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-[background-color,color] duration-200"
                style={{
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-muted)',
                }}
              >
                <span className="font-mono text-[10px] opacity-70">{opt.glyph}</span>
                <span className="text-[11px]">{opt.label}</span>
              </button>
            )
          })}
        </div>

        {recentOnly && (
          <button
            onClick={() => setRecentOnly(false)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: 'var(--color-accent-bg, rgba(245,158,11,0.1))',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
            }}
          >
            <Clock className="h-3 w-3" />
            Son 7 gün
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ═══════════════ UPLOAD PROGRESS ═══════════════ */}
      {Object.keys(uploadProgress).length > 0 && (
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: 'var(--color-primary-light, rgba(13,150,104,0.1))' }}
              >
                <Upload className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Yükleme Akışı</p>
                <p className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {Object.values(uploadProgress).filter(s => s.status === 'done').length} / {Object.keys(uploadProgress).length} tamamlandı
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {Object.entries(uploadProgress).map(([name, state]) => {
              const pct = state.total > 0 ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : 0
              const elapsedSec = (Date.now() - state.startedAt) / 1000
              const speed = elapsedSec > 0 ? state.loaded / elapsedSec : 0
              const remainingBytes = Math.max(0, state.total - state.loaded)
              const etaSec = speed > 0 && state.status === 'uploading' ? remainingBytes / speed : 0

              const barBg =
                state.status === 'error' ? 'var(--color-error)' :
                state.status === 'done'  ? 'var(--color-success, #10b981)' :
                'var(--color-primary)'

              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {state.status === 'done' && (
                        <BadgeCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-success, #10b981)' }} />
                      )}
                      {state.status === 'error' && (
                        <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--color-error)' }} />
                      )}
                      {state.status === 'uploading' && (
                        <span className="relative flex h-4 w-4 items-center justify-center flex-shrink-0">
                          <span className="absolute h-4 w-4 rounded-full animate-ping" style={{ background: 'var(--color-primary)', opacity: 0.3 }} />
                          <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                        </span>
                      )}
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }} title={name}>{name}</span>
                    </div>
                    <span
                      className="text-xs font-mono font-bold tabular-nums flex-shrink-0"
                      style={{
                        color:
                          state.status === 'error' ? 'var(--color-error)' :
                          state.status === 'done'  ? 'var(--color-success, #10b981)' :
                          'var(--color-primary)',
                      }}
                    >
                      {state.status === 'error' ? 'HATA' : `${pct.toString().padStart(3, '0')}%`}
                    </span>
                  </div>

                  <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${pct}%`, background: barBg }}
                    />
                    {state.status === 'uploading' && pct > 0 && pct < 100 && (
                      <div
                        className="absolute inset-y-0 h-full rounded-full overflow-hidden pointer-events-none"
                        style={{ width: `${pct}%` }}
                      >
                        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_1.5s_infinite]" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{formatBytes(state.loaded)} / {formatBytes(state.total)}</span>
                    {state.status === 'uploading' && (
                      <span className="flex items-center gap-3">
                        <span>↑ {formatBytes(speed)}/sn</span>
                        <span>{formatEta(etaSec)}</span>
                      </span>
                    )}
                    {state.status === 'done' && <span style={{ color: 'var(--color-success, #10b981)' }}>Yüklendi</span>}
                    {state.status === 'error' && <span style={{ color: 'var(--color-error)' }}>Yüklenemedi</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ THUMBNAIL GRID ═══════════════ */}
      {items.length === 0 && !isLoading && !recentOnly && (
        <EmptyState onUpload={() => fileInputRef.current?.click()} />
      )}

      {items.length === 0 && recentOnly && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            background: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} strokeWidth={1.5} />
          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Son 7 günde yükleme yok</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Tüm varlıkları görmek için filtreyi kaldırın</p>
        </div>
      )}

      {items.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className="relative"
        >
          {isDraggingOver && (
            <div
              className="absolute inset-0 z-20 rounded-2xl flex items-center justify-center pointer-events-none"
              style={{
                background: 'var(--color-primary-light, rgba(13,150,104,0.08))',
                border: '2px dashed var(--color-primary)',
              }}
            >
              <div className="text-center">
                <Upload className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>Dosyaları bırakın</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isEditing={editingItem?.id === item.id}
                editTitle={editTitle}
                onEditTitleChange={setEditTitle}
                onRename={handleRename}
                onStartEdit={() => { setEditingItem(item); setEditTitle(item.title) }}
                onDelete={() => handleDelete(item)}
                onPreview={() => handlePreview(item)}
              />
            ))}

            {page === 1 && items.length < 24 && items.length > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="group flex flex-col items-center justify-center rounded-2xl p-6 min-h-[260px] transition-[border-color,background-color,transform] duration-200 hover:-translate-y-1 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  border: '2px dashed var(--color-border)',
                }}
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl mb-3 transition-[background-color,transform] duration-200 group-hover:scale-110"
                  style={{ background: 'var(--color-primary-light, rgba(13,150,104,0.1))' }}
                >
                  <Plus className="h-6 w-6" style={{ color: 'var(--color-primary)' }} strokeWidth={2.5} />
                </span>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Yeni Varlık Ekle</p>
                <p className="font-mono text-[10px] uppercase tracking-widest mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Sürükle veya tıkla
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ PAGINATION ═══════════════ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color] duration-200"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            ← Önceki
          </button>
          <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color] duration-200"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* ═══════════════ PREVIEW MODAL ═══════════════ */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={closePreview}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'var(--color-primary-light, rgba(13,150,104,0.12))' }}
                >
                  {previewItem.contentType === 'video' && <Video className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
                  {previewItem.contentType === 'pdf' && <FileText className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
                  {previewItem.contentType === 'audio' && <Music className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-muted)' }}>Önizleme</p>
                  <h3 className="font-semibold truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                    {previewItem.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={closePreview}
                className="rounded-lg p-2 transition-[background-color] duration-200 hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" style={{ color: 'var(--color-text-primary)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[400px]" style={{ background: '#000' }}>
              {previewLoading && (
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <Film className="h-8 w-8 animate-pulse" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-mono text-xs uppercase tracking-widest">Yükleniyor</span>
                </div>
              )}
              {!previewLoading && previewUrl && previewItem.contentType === 'video' && (
                <video src={previewUrl} controls autoPlay className="max-h-[78vh] w-full">
                  Tarayıcınız video oynatmayı desteklemiyor.
                </video>
              )}
              {!previewLoading && previewUrl && previewItem.contentType === 'audio' && (
                <div className="w-full max-w-2xl p-10">
                  <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                        <Music className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{previewItem.title}</p>
                        <p className="font-mono text-xs text-white/70 uppercase tracking-wider mt-1">Ses Kaydı</p>
                      </div>
                    </div>
                    <audio src={previewUrl} controls autoPlay className="w-full">
                      Tarayıcınız ses oynatmayı desteklemiyor.
                    </audio>
                  </div>
                </div>
              )}
              {!previewLoading && previewUrl && previewItem.contentType === 'pdf' && (
                <iframe src={previewUrl} title={previewItem.title} className="w-full h-[78vh] bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════ SUB-COMPONENTS ═══════════════════════════════ */

interface MediaCardProps {
  item: MediaItem
  isEditing: boolean
  editTitle: string
  onEditTitleChange: (v: string) => void
  onRename: () => void
  onStartEdit: () => void
  onDelete: () => void
  onPreview: () => void
}

function MediaCard({ item, isEditing, editTitle, onEditTitleChange, onRename, onStartEdit, onDelete, onPreview }: MediaCardProps) {
  const meta = TYPE_META[item.contentType ?? 'video'] ?? TYPE_META.video
  const Icon = meta.icon

  return (
    <article
      className="group rounded-2xl overflow-hidden transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={onPreview}
        className="relative block w-full aspect-video overflow-hidden"
        style={{ background: 'var(--color-bg)' }}
        title="Önizle"
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-[transform] duration-500 group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-12 w-12" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center transition-[background-color] duration-300 group-hover:bg-black/35">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-xl scale-0 group-hover:scale-100 transition-[transform] duration-300">
            <Play className="h-4 w-4 text-black translate-x-0.5" fill="black" />
          </span>
        </div>

        <span
          className="absolute top-3 left-3 font-mono text-[10px] font-bold tracking-[0.12em] px-2 py-1 rounded-md backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.92)', color: '#111' }}
        >
          {meta.glyph}
        </span>

        {item.usageCount > 0 && (
          <span
            className="absolute top-3 right-3 font-mono text-[10px] font-bold px-2 py-1 rounded-md text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            ×{item.usageCount}
          </span>
        )}
      </button>

      <div className="p-4 space-y-2.5">
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onBlur={onRename}
            onKeyDown={(e) => e.key === 'Enter' && onRename()}
            className="w-full text-sm font-semibold focus:outline-none bg-transparent border-b"
            style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-primary)' }}
          />
        ) : (
          <h3
            className="text-sm font-semibold leading-snug line-clamp-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
            title={item.title}
          >
            {item.title}
          </h3>
        )}

        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: 'var(--color-primary-light, rgba(13,150,104,0.1))',
              color: 'var(--color-primary)',
            }}
          >
            <span className="h-1 w-1 rounded-full" style={{ background: 'currentColor' }} />
            {meta.label}
          </span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {item.duration > 0 ? formatDuration(item.duration) : new Date(item.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
          </span>
        </div>

        <div
          className="flex items-center justify-between pt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-muted)' }}
            title="Yeniden adlandır"
          >
            <Edit2 className="h-3 w-3" />
            Düzenle
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-muted)' }}
            title="Sil"
          >
            <Trash2 className="h-3 w-3" />
            Sil
          </button>
        </div>
      </div>
    </article>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div
      className="rounded-2xl p-16 text-center"
      style={{
        background: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
      }}
    >
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-primary-light, rgba(13,150,104,0.08))' }}
      >
        <Upload className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
      </div>
      <p className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
        Arşiv henüz boş
      </p>
      <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
        İlk video, belge veya ses dosyanızı yükleyerek klinik kütüphanenizi oluşturmaya başlayın.
      </p>
      <button
        onClick={onUpload}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
        style={{ background: 'var(--color-primary)', boxShadow: '0 6px 16px var(--color-primary-light, rgba(13,150,104,0.3))' }}
      >
        <Upload className="h-3.5 w-3.5" />
        İlk Dosyayı Yükle
      </button>
    </div>
  )
}
