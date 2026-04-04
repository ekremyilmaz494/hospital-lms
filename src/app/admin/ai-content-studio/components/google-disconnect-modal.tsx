'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'

interface GoogleDisconnectModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  disconnecting: boolean
}

export function GoogleDisconnectModal({ open, onClose, onConfirm, disconnecting }: GoogleDisconnectModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={disconnecting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 text-center"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg, 0 25px 50px rgba(0,0,0,0.12))' }}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--color-warning) 15%, var(--color-surface))' }}>
          <AlertTriangle className="h-6 w-6" style={{ color: 'var(--color-warning)' }} />
        </div>

        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Bağlantıyı Kes
        </h3>

        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Bağlantıyı kesmek istediğinizden emin misiniz?
        </p>

        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Bu işlem mevcut üretimleri etkilemez ancak yeni üretim yapamayacaksınız.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={disconnecting}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disconnecting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--color-error)', color: 'white' }}
          >
            {disconnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kesiliyor...
              </>
            ) : (
              'Bağlantıyı Kes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
