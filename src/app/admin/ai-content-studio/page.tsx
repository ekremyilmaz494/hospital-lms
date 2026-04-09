'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Settings,
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
  { key: 'all', label: 'Tümü', icon: null },
  { key: 'generating', label: 'Üretiliyor', icon: Zap },
  { key: 'completed', label: 'Tamamlanan', icon: CheckCircle2 },
  { key: 'failed', label: 'Başarısız', icon: null },
  { key: 'saved', label: 'Kütüphanede', icon: BookOpen },
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

  useEffect(() => {
    markAllAsViewed()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Search Debounce ──
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

  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (activeCount === 0) return
    const interval = setInterval(fetchItems, 10_000)
    return () => clearInterval(interval)
  }, [activeCount, fetchItems])

  useEffect(() => {
    if (prevActiveCount.current > 0 && activeCount < prevActiveCount.current) {
      const timer = setTimeout(fetchItems, 500)
      prevActiveCount.current = activeCount
      return () => clearTimeout(timer)
    }
    prevActiveCount.current = activeCount
  }, [activeCount, fetchItems])

  const handleStatusChange = (key: string) => { setStatusFilter(key); setPage(1) }
  const handleFormatChange = (value: string) => { setFormatFilter(value); setPage(1) }
  const handleSortChange = (value: string) => { setSort(value); setPage(1) }

  const completedCount = items.filter((i) => i.status === 'completed').length
  const savedCount = items.filter((i) => i.savedToLibrary).length

  const stats = [
    { label: 'Toplam İçerik', value: total, color: '#0d9668', icon: Sparkles, gradient: 'linear-gradient(135deg, #0d9668, #065f46)' },
    { label: 'Aktif Üretim', value: activeCount, color: '#f59e0b', icon: Zap, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', pulse: activeCount > 0 },
    { label: 'Tamamlanan', value: completedCount, color: '#10b981', icon: CheckCircle2, gradient: 'linear-gradient(135deg, #10b981, #059669)' },
    { label: 'Kütüphanede', value: savedCount, color: '#3b82f6', icon: BookOpen, gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  ]

  return (
    <div className="min-h-screen p-6 lg:p-8" style={{ background: 'var(--color-bg)' }}>

      {/* ══ Hero Header ══ */}
      <BlurFade delay={0}>
        <div
          className="relative mb-8 overflow-hidden rounded-3xl p-7 lg:p-9"
          style={{
            background: 'linear-gradient(135deg, #0d9668 0%, #065f46 50%, #064e3b 100%)',
            boxShadow: '0 20px 60px rgba(13,150,104,0.2)',
          }}
        >
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: 0.08 }}>
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Floating orbs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)' }} />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1
                  className="text-2xl font-extrabold text-white lg:text-3xl"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  AI İçerik Stüdyosu
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  NotebookLM ile eğitim içeriklerinizi otomatik oluşturun
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/admin/ai-content-studio/settings"
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <Settings className="h-4 w-4 text-white/70" />
              </Link>
              <Link
                href="/admin/ai-content-studio/new"
                className="flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-bold transition-all duration-200 hover:scale-[1.03]"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#065f46',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                }}
              >
                <Plus className="h-4 w-4" />
                Yeni İçerik Oluştur
              </Link>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* ══ Stat Kartları ══ */}
      <BlurFade delay={0.04}>
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="relative overflow-hidden rounded-2xl border p-5"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.06 + i * 0.05 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              {/* Background glow */}
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full"
                style={{ background: `radial-gradient(circle, color-mix(in srgb, ${stat.color} 10%, transparent), transparent 70%)` }}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: stat.gradient }}
                  >
                    <stat.icon className="h-4.5 w-4.5 text-white" />
                  </div>
                  {stat.pulse && (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: stat.color }} />
                      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: stat.color }} />
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <span
                    className="text-2xl font-extrabold tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                  >
                    {stat.value}
                  </span>
                  <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </BlurFade>

      {/* ══ Filtre Barı ══ */}
      <BlurFade delay={0.08}>
        <div
          className="mb-6 rounded-2xl border p-4"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => handleStatusChange(tab.key)}
                  className="relative rounded-xl px-4 py-2 text-[12px] font-semibold transition-all duration-200"
                  style={{
                    background: active ? 'var(--color-primary)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.icon && <tab.icon className="h-3 w-3" />}
                    {tab.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--color-primary)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Search + Filters row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1" style={{ maxWidth: 400 }}>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                type="text"
                placeholder="İçerik ara..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-[13px] outline-none transition-shadow duration-200 focus:ring-2"
                style={{
                  background: 'var(--color-surface-hover)',
                  color: 'var(--color-text-primary)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <select
                  value={formatFilter}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="appearance-none rounded-xl border-0 py-2.5 pl-9 pr-8 text-[12px] font-medium outline-none"
                  style={{
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <option value="all">Tüm Formatlar</option>
                  {FORMAT_CONFIGS.map((f) => (
                    <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <ArrowUpDown
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="appearance-none rounded-xl border-0 py-2.5 pl-9 pr-8 text-[12px] font-medium outline-none"
                  style={{
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* ══ İçerik Grid ══ */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="flex flex-col items-center justify-center gap-3 py-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <div
                className="absolute inset-0 animate-ping rounded-full"
                style={{ border: '2px solid var(--color-primary)', opacity: 0.2 }}
              />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              İçerikler yükleniyor...
            </p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            className="rounded-2xl border p-10 text-center"
            style={{ background: 'color-mix(in srgb, var(--color-error) 5%, var(--color-surface))', borderColor: 'color-mix(in srgb, var(--color-error) 20%, var(--color-border))' }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>{error}</p>
            <button
              onClick={fetchItems}
              className="mt-4 rounded-xl px-5 py-2 text-[12px] font-bold transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              Tekrar Dene
            </button>
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            className="rounded-2xl border p-16 text-center"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-hover))' }}
            >
              <FolderOpen className="h-10 w-10" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }} />
            </div>
            <h3
              className="text-[16px] font-bold mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              {search || statusFilter !== 'all' || formatFilter !== 'all'
                ? 'Eşleşen içerik bulunamadı'
                : 'AI ile içerik oluşturmak için "Yeni İçerik" butonunu kullanın.'}
            </h3>
            <p className="text-[13px] mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              {search || statusFilter !== 'all' || formatFilter !== 'all'
                ? 'Filtrelerinizi değiştirerek tekrar arayın'
                : 'AI ile ilk eğitim içeriğinizi oluşturmaya başlayın'}
            </p>
            {statusFilter === 'all' && formatFilter === 'all' && !search && (
              <Link
                href="/admin/ai-content-studio/new"
                className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-[13px] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #0d9668, #065f46)',
                  boxShadow: '0 8px 24px rgba(13,150,104,0.25)',
                }}
              >
                <Sparkles className="h-4 w-4" />
                İlk İçeriğinizi Oluşturun
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
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
                  index={i}
                />
              ))}
            </div>

            {/* ── Sayfalama ── */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[12px] font-semibold transition-all duration-200 disabled:opacity-30 hover:border-[var(--color-primary)]"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Önceki
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page - 2 + i
                  if (pageNum < 1 || pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold transition-all duration-200"
                      style={{
                        background: pageNum === page ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: pageNum === page ? 'white' : 'var(--color-text-secondary)',
                        border: pageNum === page ? 'none' : '1px solid var(--color-border)',
                      }}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[12px] font-semibold transition-all duration-200 disabled:opacity-30 hover:border-[var(--color-primary)]"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
