'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Pulsing stat card placeholder */
export function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl border p-5 animate-pulse"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 rounded" style={{ background: 'var(--color-surface-hover)' }} />
        <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-surface-hover)' }} />
      </div>
      <div className="h-8 w-16 rounded mb-2" style={{ background: 'var(--color-surface-hover)' }} />
      <div className="h-3 w-20 rounded" style={{ background: 'var(--color-surface-hover)' }} />
    </div>
  )
}

/** Pulsing chart placeholder */
export function ChartSkeleton() {
  return (
    <div className="h-64 rounded-2xl border animate-pulse" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
  )
}

/** Pulsing table rows */
export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="px-6 py-4 animate-pulse" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-surface-hover)' }} />
          <div>
            <div className="h-4 w-32 rounded mb-1" style={{ background: 'var(--color-surface-hover)' }} />
            <div className="h-3 w-48 rounded" style={{ background: 'var(--color-surface-hover)' }} />
          </div>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
            <div className="h-8 w-8 rounded-full" style={{ background: 'var(--color-surface-hover)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded" style={{ background: 'var(--color-surface-hover)' }} />
              <div className="h-3 w-40 rounded" style={{ background: 'var(--color-surface-hover)' }} />
            </div>
            <div className="h-6 w-20 rounded-full" style={{ background: 'var(--color-surface-hover)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pulsing list items */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3 mb-5 animate-pulse">
        <div className="h-9 w-9 rounded-xl" style={{ background: 'var(--color-surface-hover)' }} />
        <div className="h-4 w-36 rounded" style={{ background: 'var(--color-surface-hover)' }} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3 animate-pulse">
            <div className="h-9 w-9 rounded-full" style={{ background: 'var(--color-surface-hover)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded" style={{ background: 'var(--color-surface-hover)' }} />
              <div className="h-3 w-20 rounded" style={{ background: 'var(--color-surface-hover)' }} />
            </div>
            <div className="h-4 w-12 rounded" style={{ background: 'var(--color-surface-hover)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pulsing compliance/alert cards */
export function AlertSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-4 animate-pulse">
        <div className="h-8 w-8 rounded-lg" style={{ background: 'var(--color-surface-hover)' }} />
        <div>
          <div className="h-4 w-28 rounded mb-1" style={{ background: 'var(--color-surface-hover)' }} />
          <div className="h-3 w-44 rounded" style={{ background: 'var(--color-surface-hover)' }} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl p-3 animate-pulse" style={{ background: 'var(--color-surface-hover)' }}>
            <div className="h-3 w-32 rounded mb-2" style={{ background: 'var(--color-surface)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--color-surface)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Inline section error with retry */
export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-5 py-4"
      style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-error)' }} />
      <p className="flex-1 text-sm" style={{ color: 'var(--color-error)' }}>{message}</p>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0 rounded-lg text-xs"
        style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
        onClick={onRetry}
      >
        <RefreshCw className="h-3 w-3" /> Tekrar Dene
      </Button>
    </div>
  )
}
