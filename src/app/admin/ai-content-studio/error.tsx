'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { K } from '@/components/ai-studio/k-tokens'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AiStudioError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Hata sunucu loguna düşsün — gerçek logger sayfa içinde import edilemez,
    // bu yüzden burada console.error tek istisna; production'da Sentry yakalar.
    console.error('[ai-content-studio] page error', error)
  }, [error])

  return (
    <div style={{ background: K.BG, minHeight: '100vh', padding: 24 }}>
      <div
        style={{
          maxWidth: 560, margin: '64px auto 0', background: K.SURFACE,
          border: `1px solid ${K.ERROR}`, borderRadius: 16, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={22} color={K.ERROR} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY }}>
            AI İçerik Stüdyosu yüklenemedi
          </h2>
        </div>
        <p style={{ margin: 0, color: K.TEXT_SECONDARY, fontSize: 14, lineHeight: 1.6 }}>
          Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin; sorun devam ederse
          sistem yöneticinize bildirin.
        </p>
        {error.digest && (
          <code style={{
            fontSize: 12, color: K.TEXT_MUTED, background: K.BG,
            padding: '4px 8px', borderRadius: 6, alignSelf: 'flex-start',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            referans: {error.digest}
          </code>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 16px', borderRadius: 10,
            background: K.PRIMARY, color: K.SURFACE,
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />
          Yeniden dene
        </button>
      </div>
    </div>
  )
}
