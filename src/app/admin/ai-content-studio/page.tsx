'use client'

// AI İçerik Stüdyosu — Ana Sayfa (İçerik Kütüphanesi)
// Tüm üretilmiş içerikleri kart grid olarak listeler
// Filtreleme, arama, sıralama, sayfalama, otomatik yenileme

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Zap,
  CheckCircle2,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { useAiGenerationStore, selectActiveCount } from '@/store/ai-generation-store'
import { ContentCard } from './components/content-card'
import { FORMAT_CONFIGS } from './lib/format-config'
import { ITEMS_PER_PAGE } from './constants'
import type { ContentHistoryItem, ContentListResponse } from './types'

// ── Durum Sekmeleri ──
const STATUS_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'generating', label: 'Üretiliyor' },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'failed', label: 'Başarısız' },
  { key: 'saved', label: 'Kütüphanede' },
] as const

// ── Sıralama Seçenekleri ──
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'En Yeni' },
  { value: 'createdAt:asc', label: 'En Eski' },
  { value: 'title:asc', label: 'Başlık A-Z' },
  { value: 'title:desc', label: 'Başlık Z-A' },
] as const

export default function AIContentStudioPage() {
  // ── State ──
  const [items, setItems] = useState<ContentHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [sort, setSort] = useState('createdAt:desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Store ──
  const activeCount = useAiGenerationStore(selectActiveCount)
  const markAllAsViewed = useAiGenerationStore((s) => s.markAllAsViewed)
  const prevActiveCount = useRef(activeCount)

  // ── Mount: Sidebar badge sıfırla ──
  useEffect(() => {
    markAllAsViewed()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Search Debounce (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ── Data Fetching ──
  const fetchItems = useCallback(async () => {
    try {
      setError(null)
      const [sortBy, sortOrder] = sort.split(':')
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
        sortBy: sortBy,
        sortOrder: sortOrder,
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (formatFilter !== 'all') params.set('artifactType', formatFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/ai-content-studio/list?${params}`)
      if (!res.ok) throw new Error('Liste alınamadı')

      const data: ContentListResponse = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('İçerikler yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, formatFilter, search, sort])

  // ── Filtre/sayfa değiştiğinde refetch ──
  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  // ── Aktif üretim varsa 10s interval ──
  useEffect(() => {
    if (activeCount === 0) return
    const interval = setInterval(fetchItems, 10_000)
    return () => clearInterval(interval)
  }, [activeCount, fetchItems])

  // ── Bir job tamamlandığında (activeCount düştü) 500ms sonra refetch ──
  useEffect(() => {
    if (prevActiveCount.current > 0 && activeCount < prevActiveCount.current) {
      const timer = setTimeout(fetchItems, 500)
      prevActiveCount.current = activeCount
      return () => clearTimeout(timer)
    }
    prevActiveCount.current = activeCount
  }, [activeCount, fetchItems])

  // ── Filtre değiştirince sayfa 1'e dön ──
  const handleStatusChange = (key: string) => {
    setStatusFilter(key)
    setPage(1)
  }

  const handleFormatChange = (value: string) => {
    setFormatFilter(value)
    setPage(1)
  }

  const handleSortChange = (value: string) => {
    setSort(value)
    setPage(1)
  }

  // ── Stat kartları için hesaplama ──
  const completedCount = items.filter((i) => i.status === 'completed').length
  const savedCount = items.filter((i) => i.savedToLibrary).length

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <BlurFade delay={0}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                AI İçerik Stüdyosu
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Üretilen içeriklerinizi yönetin
              </p>
            </div>
          </div>
          <Link
            href="/admin/ai-content-studio/new"
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-transform duration-200 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Plus className="h-4 w-4" />
            Yeni İçerik Oluştur
          </Link>
        </div>
      </BlurFade>

      {/* ── Stat Kartları ── */}
      <BlurFade delay={0.03}>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Toplam İçerik', value: total, color: 'var(--color-primary)', icon: Sparkles },
            {
              label: 'Aktif Üretim',
              value: activeCount,
              color: 'var(--color-warning)',
              icon: Zap,
              pulse: activeCount > 0,
            },
            { label: 'Tamamlanan', value: completedCount, color: 'var(--color-success)', icon: CheckCircle2 },
            { label: 'Kütüphanede', value: savedCount, color: 'var(--color-info)', icon: BookOpen },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${stat.color} 15%, transparent)` }}
              >
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {stat.label}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
                  >
                    {stat.value}
                  </span>
                  {stat.pulse && (
                    <span
                      className="h-2 w-2 animate-pulse rounded-full"
                      style={{ background: stat.color }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* ── Durum Sekmeleri ── */}
      <BlurFade delay={0.05}>
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatusChange(tab.key)}
              className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-colors duration-200"
              style={{
                background:
                  statusFilter === tab.key
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)',
                color:
                  statusFilter === tab.key
                    ? '#fff'
                    : 'var(--color-text-secondary)',
                border: `1px solid ${statusFilter === tab.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </BlurFade>

      {/* ── Arama + Filtre + Sıralama ── */}
      <BlurFade delay={0.08}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Arama */}
          <div
            className="relative flex-1"
            style={{ maxWidth: 360 }}
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Başlık ile ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-[13px] outline-none transition-colors duration-200"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            />
          </div>

          {/* Format Filtresi */}
          <div className="relative">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <select
              value={formatFilter}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="appearance-none rounded-xl border py-2.5 pl-9 pr-8 text-[12px] font-medium outline-none transition-colors duration-200"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <option value="all">Tüm Formatlar</option>
              {FORMAT_CONFIGS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sıralama */}
          <div className="relative">
            <ArrowUpDown
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="appearance-none rounded-xl border py-2.5 pl-9 pr-8 text-[12px] font-medium outline-none transition-colors duration-200"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </BlurFade>

      {/* ── İçerik Grid ── */}
      <BlurFade delay={0.12}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: 'var(--color-primary)' }}
            />
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}
          >
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
            <button
              onClick={fetchItems}
              className="mt-3 rounded-xl px-4 py-2 text-[12px] font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              Tekrar Dene
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl border p-16 text-center"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <FolderOpen
              className="mx-auto h-16 w-16 mb-4"
              style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
            />
            <h3
              className="text-[16px] font-bold mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              {search || statusFilter !== 'all' || formatFilter !== 'all'
                ? 'Eşleşen içerik bulunamadı'
                : 'Henüz içerik oluşturulmadı'}
            </h3>
            <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-muted)' }}>
              {search || statusFilter !== 'all' || formatFilter !== 'all'
                ? 'Filtrelerinizi değiştirerek tekrar arayın'
                : 'AI ile ilk eğitim içeriğinizi oluşturmaya başlayın'}
            </p>
            {statusFilter === 'all' && formatFilter === 'all' && !search && (
              <Link
                href="/admin/ai-content-studio/new"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <Sparkles className="h-4 w-4" />
                İlk İçeriğinizi Oluşturun
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ContentCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  artifactType={item.artifactType}
                  status={item.status}
                  progress={item.progress}
                  evaluation={item.evaluation}
                  savedToLibrary={item.savedToLibrary}
                  error={item.error}
                  createdAt={item.createdAt}
                />
              ))}
            </div>

            {/* ── Sayfalama ── */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12px] font-semibold transition-opacity duration-200 disabled:opacity-40"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Önceki
                </button>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12px] font-semibold transition-opacity duration-200 disabled:opacity-40"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface)',
                  }}
                >
                  Sonraki
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </BlurFade>
    </div>
  )
}
