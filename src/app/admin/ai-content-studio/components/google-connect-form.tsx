'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

interface GoogleConnectFormProps {
  onConnect: (email: string, browser?: string) => Promise<void>
  connecting: boolean
  error: string | null
}

export function GoogleConnectForm({ onConnect, connecting, error }: GoogleConnectFormProps) {
  const [email, setEmail] = useState('')
  const [browser, setBrowser] = useState<'chromium' | 'msedge'>('chromium')

  const handleSubmit = async () => {
    if (!email.trim()) return
    await onConnect(email.trim(), browser)
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Google Hesabı Bağla
      </h3>

      <div className="mt-5 space-y-4">
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            E-posta Adresi
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@gmail.com"
              disabled={connecting}
              className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            />
          </div>
        </div>

        {/* Browser */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Tarayıcı
          </label>
          <div className="flex gap-2">
            {([['chromium', 'Chromium'], ['msedge', 'Microsoft Edge']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setBrowser(val)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  background: browser === val ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  color: browser === val ? 'white' : 'var(--color-text-secondary)',
                  border: `1px solid ${browser === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div
          className="rounded-xl p-3 text-xs"
          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
        >
          ℹ️ Bağlantı sırasında sunucuda bir tarayıcı penceresi açılacaktır. Google hesabınızla giriş yapın.
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-surface))',
              color: 'var(--color-error)',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={connecting || !email.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          {connecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Bağlanıyor...
            </>
          ) : (
            'Bağlan'
          )}
        </button>
      </div>
    </div>
  )
}
