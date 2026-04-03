// ─── Bağlantı Gerekli Banner ───
// Google hesabı bağlı değilse gösterilen uyarı banner'ı
// Ana sayfa ve üretim akışında kullanılır

'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function ConnectionRequiredBanner() {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border p-4"
      style={{
        background: 'var(--color-warning-bg)',
        borderColor: 'var(--color-warning)',
        borderLeft: '4px solid var(--color-warning)',
      }}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-warning)' }} />
      <div className="flex-1">
        <p className="text-[13px] font-bold" style={{ color: 'var(--color-warning)' }}>
          Google Hesabı Bağlı Değil
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          AI içerik üretmek için Google NotebookLM hesabınızı bağlayın.
        </p>
      </div>
      <Link
        href="/admin/ai-content-studio/settings"
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white transition-all"
        style={{ background: 'var(--color-warning)', boxShadow: 'var(--shadow-sm)' }}
      >
        Hesap Bağla
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
