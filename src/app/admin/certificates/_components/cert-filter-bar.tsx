'use client'

import { Search, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BlurFade } from '@/components/ui/blur-fade'
import type { FilterState, StatusFilter, TrainingOption, ViewMode } from '../_types'

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
        className="flex items-center gap-3 rounded-xl border px-5 py-3 mb-6 flex-wrap"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Personel, sertifika kodu veya eğitim ara..."
            className="pl-9 h-10 rounded-lg text-[13px]"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg)' }}>
          {STATUS_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange({ status: f.key })}
              aria-label={`Filtrele: ${f.label}`}
              aria-pressed={filters.status === f.key}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150"
              style={{
                background: filters.status === f.key ? 'var(--color-primary)' : 'transparent',
                color: filters.status === f.key ? 'white' : 'var(--color-text-muted)',
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
            className="h-10 rounded-lg border px-3 text-[12px]"
            style={{
              background: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
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
            className="h-10 rounded-lg border px-3 text-[12px] max-w-[240px]"
            style={{
              background: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">Tüm Eğitimler</option>
            {trainings.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.count})</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg)' }}>
          <button
            onClick={() => onViewModeChange('grouped')}
            aria-label="Gruplu görünüm"
            aria-pressed={viewMode === 'grouped'}
            title="Gruplu görünüm"
            className="flex items-center justify-center h-7 w-7 rounded-md transition-colors duration-150"
            style={{
              background: viewMode === 'grouped' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'grouped' ? 'white' : 'var(--color-text-muted)',
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
              background: viewMode === 'flat' ? 'var(--color-primary)' : 'transparent',
              color: viewMode === 'flat' ? 'white' : 'var(--color-text-muted)',
            }}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-[12px] font-mono ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {resultCount} sonuç
        </span>
      </div>
    </BlurFade>
  )
}
