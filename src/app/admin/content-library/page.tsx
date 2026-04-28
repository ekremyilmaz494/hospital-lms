'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Library, Clock, Star, CheckCircle2, Plus, Layers, X, ArrowRight,
  Film, Search,
  BookOpen, GraduationCap, Trash2, ChevronRight,
} from 'lucide-react'
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
import { K, type ContentLibraryItem } from './_components/shared'

// Modal'lar kullanıcı etkileşimine kadar yüklenmez — initial bundle küçülür.
const BulkInstallModal = dynamic(() => import('./_components/bulk-install-modal'), { ssr: false })
const DeleteConfirmModal = dynamic(() => import('./_components/delete-confirm-modal'), { ssr: false })
const UploadContentModal = dynamic(() => import('./_components/upload-content-modal'), { ssr: false })

interface PageData {
  items: ContentLibraryItem[]
  total?: number
  page?: number
  limit?: number
  totalPages?: number
  stats?: {
    installedCount: number
    installRate: number
    totalDurationMin: number
    totalSmg: number
  }
}


// ── İçerik Kartı ─────────────────────────────────────────────────────────

interface ContentCardProps {
  item: ContentLibraryItem
  onInstall: (id: string) => Promise<void>
  installing: boolean
  onDelete: (item: ContentLibraryItem) => void
  deleting: boolean
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

// ── Platform Kütüphanesi Sekmesi ──────────────────────────────────────────

function PlatformLibraryTab() {
  const { toast } = useToast()
  // limit=500: API tarafına server-side pagination eklendi; bu UI henüz "load more"
  // kontrolüne sahip değil, kütüphanenin tamamını tek seferde alabilmek için 500'e
  // kadar yükle (500'den fazla içerik olduğunda UI sayfa kontrolü eklenmeli).
  const { data, isLoading, error, refetch } = useFetch<PageData>('/api/admin/content-library?limit=500')
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
  // KPI'lar artık API'den geliyor — tüm filtre kapsamı için doğru, sayfaya bağlı değil
  const totalLibraryCount = data?.total ?? allItems.length
  const installedCount = data?.stats?.installedCount ?? allItems.filter(i => i.isInstalled).length
  const installRate = data?.stats?.installRate ?? (totalLibraryCount > 0 ? Math.round((installedCount / totalLibraryCount) * 100) : 0)
  const totalDurationMin = data?.stats?.totalDurationMin ?? allItems.reduce((s, i) => s + i.duration, 0)
  const totalSmg = data?.stats?.totalSmg ?? allItems.reduce((s, i) => s + i.smgPoints, 0)

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
            Hazır eğitim içerikleri — kuruma eklediğiniz oran <strong style={{ color: K.PRIMARY, fontWeight: 700 }}>%{installRate}</strong> ({installedCount}/{totalLibraryCount})
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
      {totalLibraryCount > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KStatCard title="Toplam İçerik" value={totalLibraryCount} icon={Library} accentColor={K.PRIMARY} />
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
