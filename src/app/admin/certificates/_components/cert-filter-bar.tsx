'use client'

import { Search, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BlurFade } from '@/components/ui/blur-fade'
import type { FilterState, StatusFilter, TrainingOption, ViewMode } from '../_types'

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
}

interface Props {
  filters: FilterState
  onFilterChange: (next: Partial<FilterState>) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  trainings: TrainingOption[]
  categories: string[]
  resultCount: number
}

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'expiring', label: 'Yaklaşan' },
  { key: 'expired', label: 'Dolmuş' },
  { key: 'revoked', label: 'İptal' },
]

export function CertFilterBar({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  trainings,
  categories,
  resultCount,
}: Props) {
  return (
    <BlurFade delay={0.06}>
      <div
        className="flex items-center gap-3 px-5 py-3 mb-6 flex-wrap"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 14,
          boxShadow: K.SHADOW_CARD,
        }}
      >
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: K.TEXT_MUTED }}
          />
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Personel, sertifika kodu veya eğitim ara..."
            className="pl-9 h-10 rounded-lg text-[13px]"
            style={{ background: K.BG, borderColor: K.BORDER }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: K.BG }}>
          {STATUS_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange({ status: f.key })}
              aria-label={`Filtrele: ${f.label}`}
              aria-pressed={filters.status === f.key}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150"
              style={{
                background: filters.status === f.key ? K.PRIMARY : 'transparent',
                color: filters.status === f.key ? '#ffffff' : K.TEXT_MUTED,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value })}
            aria-label="Kategori filtresi"
            className="h-10 rounded-lg px-3 text-[12px]"
            style={{
              background: K.BG,
              border: `1px solid ${K.BORDER}`,
              color: K.TEXT_PRIMARY,
            }}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}

        {trainings.length > 0 && (
          <select
            value={filters.trainingId}
            onChange={(e) => onFilterChange({ trainingId: e.target.value })}
            aria-label="Eğitim filtresi"
            className="h-10 rounded-lg px-3 text-[12px] max-w-[240px]"
            style={{
              background: K.BG,
              border: `1px solid ${K.BORDER}`,
              color: K.TEXT_PRIMARY,
            }}
          >
            <option value="">Tüm Eğitimler</option>
            {trainings.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.count})</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: K.BG }}>
          <button
            onClick={() => onViewModeChange('grouped')}
            aria-label="Gruplu görünüm"
            aria-pressed={viewMode === 'grouped'}
            title="Gruplu görünüm"
            className="flex items-center justify-center h-7 w-7 rounded-md transition-colors duration-150"
            style={{
              background: viewMode === 'grouped' ? K.PRIMARY : 'transparent',
              color: viewMode === 'grouped' ? '#ffffff' : K.TEXT_MUTED,
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('flat')}
            aria-label="Düz liste görünüm"
            aria-pressed={viewMode === 'flat'}
            title="Düz liste"
            className="flex items-center justify-center h-7 w-7 rounded-md transition-colors duration-150"
            style={{
              background: viewMode === 'flat' ? K.PRIMARY : 'transparent',
              color: viewMode === 'flat' ? '#ffffff' : K.TEXT_MUTED,
            }}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-[12px] font-mono ml-auto" style={{ color: K.TEXT_MUTED }}>
          {resultCount} sonuç
        </span>
      </div>
    </BlurFade>
  )
}
