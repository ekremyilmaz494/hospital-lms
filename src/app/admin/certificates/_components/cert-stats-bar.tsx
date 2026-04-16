'use client'

import { Award, CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import type { CertStats, FilterStats } from '../_types'

interface Props {
  stats: CertStats
  filterStats: FilterStats
  filtersActive: boolean
}

export function CertStatsBar({ stats, filterStats, filtersActive }: Props) {
  const cards = [
    { label: 'Toplam Sertifika', value: stats.totalCerts, icon: Award, color: 'var(--color-primary)' },
    { label: 'Aktif', value: stats.activeCerts, icon: CheckCircle2, color: 'var(--color-success)' },
    { label: 'Süresi Dolacak', value: stats.expiringSoon, icon: Clock, color: 'var(--color-warning)' },
    { label: 'Süresi Dolmuş', value: stats.expiredCerts, icon: AlertTriangle, color: 'var(--color-error)' },
  ]

  return (
    <BlurFade delay={0.03}>
      <div className="grid grid-cols-4 gap-4 mb-4">
        {cards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {s.label}
              </span>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${s.color}12` }}
              >
                <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {filtersActive && (
        <div
          className="flex items-center gap-4 rounded-xl border px-4 py-2 mb-6 text-[12px]"
          style={{
            background: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Filtre:
          </span>
          <span className="font-mono">
            <strong style={{ color: 'var(--color-text-primary)' }}>{filterStats.visible}</strong> sonuç
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
            <span className="font-mono">{filterStats.active} aktif</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" style={{ color: 'var(--color-warning)' }} />
            <span className="font-mono">{filterStats.expiring} yaklaşan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-error)' }} />
            <span className="font-mono">{filterStats.expired} dolmuş</span>
          </span>
          {stats.revokedCerts > 0 && (
            <span className="flex items-center gap-1.5">
              <Ban className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
              <span className="font-mono">{filterStats.revoked} iptal</span>
            </span>
          )}
        </div>
      )}
    </BlurFade>
  )
}
