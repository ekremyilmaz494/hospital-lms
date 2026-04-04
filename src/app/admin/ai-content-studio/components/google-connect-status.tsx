'use client'

import { CheckCircle, XCircle, Loader2, Shield } from 'lucide-react'

interface GoogleConnectStatusProps {
  connected: boolean
  email: string | null
  status: string | null
  lastVerifiedAt: string | null
  onVerify: () => Promise<void>
  onDisconnect: () => void
  verifying: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GoogleConnectStatus({
  connected,
  email,
  lastVerifiedAt,
  onVerify,
  onDisconnect,
  verifying,
}: GoogleConnectStatusProps) {
  if (!connected) {
    return (
      <div
        className="flex items-center gap-4 rounded-2xl p-5"
        style={{
          background: 'var(--color-surface-hover)',
          border: '1px solid var(--color-border)',
        }}
      >
        <XCircle className="h-6 w-6 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Bağlantı Yok
          </p>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Henüz bir Google hesabı bağlanmamış.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))',
        border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
      }}
    >
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-success)' }} />
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: 'var(--color-success)', color: 'white' }}
        >
          Bağlı
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {email}
        </span>
      </div>

      {lastVerifiedAt && (
        <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Shield className="h-3.5 w-3.5" />
          Son doğrulama: {formatDate(lastVerifiedAt)}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {verifying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Doğrulanıyor...
            </>
          ) : (
            'Doğrula'
          )}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--color-error)' }}
        >
          Bağlantıyı Kes
        </button>
      </div>
    </div>
  )
}
