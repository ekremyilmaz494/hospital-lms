'use client'

import React, { useState, useCallback, useRef } from 'react'
import {
  Film, Upload, Search, Trash2, FileText, Music, Video,
  MoreVertical, Edit2, Grid, List, FolderOpen, AlertCircle,
} from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useToast } from '@/components/shared/toast'

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

const CONTENT_TYPE_LABELS: Record<string, { label: string; icon: typeof Video; color: string }> = {
  video: { label: 'Video', icon: Video, color: 'text-blue-600 bg-blue-50' },
  pdf: { label: 'PDF', icon: FileText, color: 'text-red-600 bg-red-50' },
  audio: { label: 'Ses', icon: Music, color: 'text-purple-600 bg-purple-50' },
}

export default function MediaLibraryPage() {
  const [search, setSearch] = useState('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const queryParams = new URLSearchParams({ page: String(page), limit: '24' })
  if (search) queryParams.set('search', search)
  if (contentTypeFilter) queryParams.set('contentType', contentTypeFilter)

  const { data, isLoading, error, refetch } = useFetch<MediaListResponse>(
    `/api/admin/media-library?${queryParams}`,
  )

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    const fileArray = Array.from(files).slice(0, 20)

    // 1) Presign URL'leri al
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

      const { results } = await res.json() as { results: Array<{ id?: string; uploadUrl?: string; fileName: string; error?: string }> }

      // 2) Her dosyayı S3'e yükle
      const uploads = results
        .filter((r): r is { id: string; uploadUrl: string; fileName: string } => !!r.uploadUrl && !!r.id)
        .map(async (result) => {
          const file = fileArray.find(f => f.name === result.fileName)
          if (!file) return

          return new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setUploadProgress(prev => ({ ...prev, [result.fileName]: Math.round((e.loaded / e.total) * 100) }))
              }
            }
            xhr.onload = () => {
              setUploadProgress(prev => ({ ...prev, [result.fileName]: 100 }))
              resolve()
            }
            xhr.onerror = () => {
              toast(`${result.fileName} yüklenemedi`, 'error')
              resolve()
            }
            xhr.open('PUT', result.uploadUrl)
            xhr.setRequestHeader('Content-Type', file.type)
            xhr.send(file)
          })
        })

      await Promise.all(uploads)

      const successCount = results.filter(r => !r.error).length
      const failCount = results.filter(r => r.error).length
      toast(`${successCount} dosya yüklendi${failCount > 0 ? `, ${failCount} başarısız` : ''}`, 'success')

      setUploadProgress({})
      refetch()
    } catch {
      toast('Yükleme sırasında bir hata oluştu', 'error')
    } finally {
      setUploading(false)
    }
  }, [toast, refetch])

  const handleDelete = useCallback(async (item: MediaItem) => {
    if (!confirm(`"${item.title}" silinecek. Emin misiniz?`)) return

    const res = await fetch(`/api/admin/media-library/${item.id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      toast(data.error || 'Silinemedi', 'error')
      return
    }

    toast(`"${item.title}" medya kütüphanesinden kaldırıldı`, 'success')
    refetch()
  }, [toast, refetch])

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  if (isLoading && !data) return <PageLoading />
  if (error) return <div className="p-8 text-center text-red-500">Medya kütüphanesi yüklenemedi</div>

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Medya Kütüphanesi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Video, PDF ve ses dosyalarınızı yönetin. Eğitim oluştururken kütüphaneden seçebilirsiniz.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Yükleniyor...' : 'Dosya Yükle'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,.pdf,.pptx"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Yükleme Durumu</p>
          {Object.entries(uploadProgress).map(([name, progress]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground truncate w-48">{name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-medium w-10 text-right">{progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Dosyaları sürükleyip bırakın veya tıklayın</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Video (500MB), Ses (200MB), PDF (100MB) — Tek seferde 20 dosya</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Medya ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
          {[
            { value: '', label: 'Tümü' },
            { value: 'video', label: 'Video' },
            { value: 'pdf', label: 'PDF' },
            { value: 'audio', label: 'Ses' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setContentTypeFilter(opt.value); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                contentTypeFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-muted' : ''}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-muted' : ''}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {data?.total ?? 0} medya
        </span>
      </div>

      {/* Empty State */}
      {items.length === 0 && !isLoading && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium text-foreground">Henüz medya yok</p>
          <p className="text-sm text-muted-foreground mt-1">İlk dosyanızı yükleyerek başlayın</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {items.map((item) => {
            const typeInfo = CONTENT_TYPE_LABELS[item.contentType ?? 'video'] ?? CONTENT_TYPE_LABELS.video
            const Icon = typeInfo.icon
            return (
              <div key={item.id} className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
                {/* Thumbnail */}
                <div className={`aspect-video flex items-center justify-center ${typeInfo.color}`}>
                  <Icon className="h-10 w-10 opacity-50" />
                </div>
                {/* Info */}
                <div className="p-3">
                  {editingItem?.id === item.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                      className="w-full text-sm font-medium border-b border-primary focus:outline-none bg-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium truncate" title={item.title}>{item.title}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${typeInfo.color}`}>
                      <Icon className="h-3 w-3" />{typeInfo.label}
                    </span>
                    {item.usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{item.usageCount} eğitimde</span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingItem(item); setEditTitle(item.title) }}
                      className="rounded p-1 hover:bg-muted"
                      title="Yeniden adlandır"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="rounded p-1 hover:bg-destructive/10"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && items.length > 0 && (
        <div className="rounded-xl border bg-card divide-y">
          {items.map((item) => {
            const typeInfo = CONTENT_TYPE_LABELS[item.contentType ?? 'video'] ?? CONTENT_TYPE_LABELS.video
            const Icon = typeInfo.icon
            return (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group">
                <div className={`flex-shrink-0 rounded-lg p-2.5 ${typeInfo.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {typeInfo.label} · {item.category} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                {item.usageCount > 0 && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.usageCount} eğitimde</span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingItem(item); setEditTitle(item.title) }}
                    className="rounded p-1.5 hover:bg-muted"
                  >
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="rounded p-1.5 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Önceki
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  )
}
