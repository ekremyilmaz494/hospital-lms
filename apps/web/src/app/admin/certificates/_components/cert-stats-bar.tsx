'use client'

import { Award, CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import type { CertStats, FilterStats } from '../_types'

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
  stats: CertStats
  filterStats: FilterStats
  filtersActive: boolean
}

export function CertStatsBar({ stats, filterStats, filtersActive }: Props) {
  const cards = [
    { label: 'Toplam Sertifika', value: stats.totalCerts, icon: Award, color: K.PRIMARY, bg: K.PRIMARY_LIGHT },
    { label: 'Aktif', value: stats.activeCerts, icon: CheckCircle2, color: K.SUCCESS, bg: K.SUCCESS_BG },
    { label: 'Süresi Dolacak', value: stats.expiringSoon, icon: Clock, color: '#b45309', bg: K.WARNING_BG },
    { label: 'Süresi Dolmuş', value: stats.expiredCerts, icon: AlertTriangle, color: '#b91c1c', bg: K.ERROR_BG },
  ]

  return (
    <BlurFade delay={0.03}>
      <div className="grid grid-cols-4 gap-4 mb-4">
        {cards.map((s) => (
          <div
            key={s.label}
            className="p-5 transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 14,
              boxShadow: K.SHADOW_CARD,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: K.TEXT_MUTED }}
              >
                {s.label}
              </span>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: s.bg }}
              >
                <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
              </div>
            </div>
            <p
              className="text-2xl font-bold font-mono tracking-tight"
              style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {filtersActive && (
        <div
          className="flex items-center gap-4 px-4 py-2 mb-6 text-[12px]"
          style={{
            background: K.BG,
            border: `1.5px solid ${K.BORDER_LIGHT}`,
            borderRadius: 14,
            color: K.TEXT_MUTED,
          }}
        >
          <span className="font-semibold" style={{ color: K.TEXT_PRIMARY }}>
            Filtre:
          </span>
          <span className="font-mono">
            <strong style={{ color: K.TEXT_PRIMARY }}>{filterStats.visible}</strong> sonuç
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" style={{ color: K.SUCCESS }} />
            <span className="font-mono">{filterStats.active} aktif</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" style={{ color: '#b45309' }} />
            <span className="font-mono">{filterStats.expiring} yaklaşan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" style={{ color: '#b91c1c' }} />
            <span className="font-mono">{filterStats.expired} dolmuş</span>
          </span>
          {stats.revokedCerts > 0 && (
            <span className="flex items-center gap-1.5">
              <Ban className="h-3 w-3" style={{ color: K.TEXT_MUTED }} />
              <span className="font-mono">{filterStats.revoked} iptal</span>
            </span>
          )}
        </div>
      )}
    </BlurFade>
  )
}
