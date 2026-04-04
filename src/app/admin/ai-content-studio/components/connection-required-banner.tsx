'use client'

import Link from 'next/link'
import { AlertTriangle, Settings } from 'lucide-react'

export function ConnectionRequiredBanner() {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl p-5"
      style={{
        background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))',
        border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
      }}
    >
      <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: 'var(--color-warning)' }} />
      <div className="flex-1">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Google Hesabı Bağlantısı Gerekli
        </h3>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          AI içerik üretmek için Google NotebookLM hesabınızı bağlamanız gerekiyor.
        </p>
      </div>
      <Link
        href="/admin/ai-content-studio/settings"
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--color-warning)', color: 'white' }}
      >
        <Settings className="h-4 w-4" />
        Bağlantı Ayarları
      </Link>
    </div>
  )
}
