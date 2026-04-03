// ─── AI İçerik Stüdyosu — Google Hesap Ayarları ───
// Google NotebookLM hesap bağlama, doğrulama ve yönetim sayfası

'use client'

import { useState } from 'react'
import { Settings, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/components/shared/toast'
import { BlurFade } from '@/components/ui/blur-fade'

import { GoogleConnectForm } from '../components/google-connect-form'
import { GoogleConnectStatus } from '../components/google-connect-status'
import { GoogleConnectTest } from '../components/google-connect-test'
import { GoogleDisconnectModal } from '../components/google-disconnect-modal'

interface ConnectionStatus {
  connected: boolean
  email: string | null
  status: string
  method?: string
  lastVerifiedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  errorMessage?: string | null
}

export default function AIContentStudioSettingsPage() {
  const { toast } = useToast()
  const { data: connection, isLoading, refetch } = useFetch<ConnectionStatus>(
    '/api/admin/ai-content-studio/auth/status'
  )
  const [connecting, setConnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const isConnected = connection?.connected ?? false

  // Bağlantı kur
  const handleConnect = async (email: string, method: string, cookieData?: string) => {
    setConnecting(true)
    try {
      let parsedCookie = undefined
      if (cookieData) {
        try {
          parsedCookie = JSON.parse(cookieData)
        } catch {
          // JSON değilse raw string olarak gönder
          parsedCookie = { raw_cookie: cookieData }
        }
      }

      const res = await fetch('/api/admin/ai-content-studio/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, method, cookieData: parsedCookie }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Bağlantı başarısız.')
      }

      toast('Google hesabı başarıyla bağlandı!', 'success')
      refetch()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bağlantı hatası.', 'error')
    } finally {
      setConnecting(false)
    }
  }

  // Bağlantı doğrula
  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/auth/verify', { method: 'POST' })
      const data = await res.json()

      if (data.connected) {
        toast('Bağlantı doğrulandı ✓', 'success')
      } else {
        toast(data.error ?? 'Bağlantı doğrulanamadı.', 'warning')
      }
      refetch()
    } catch {
      toast('Doğrulama hatası.', 'error')
    } finally {
      setVerifying(false)
    }
  }

  // Bağlantı kes
  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch('/api/admin/ai-content-studio/auth/disconnect', { method: 'POST' })
      toast('Google bağlantısı kaldırıldı.', 'success')
      setShowDisconnect(false)
      refetch()
    } catch {
      toast('Bağlantı kaldırma hatası.', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="mb-8">
          <Link
            href="/admin/ai-content-studio"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            AI İçerik Stüdyosu
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
            >
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                Google Hesap Bağlantısı
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                NotebookLM ile içerik üretmek için Google hesabınızı bağlayın
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="max-w-2xl">
        <BlurFade delay={0.08}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : isConnected && connection ? (
            /* ── Bağlı durumda ── */
            <div className="space-y-4">
              <GoogleConnectStatus connection={connection} />

              {/* Aksiyon butonları */}
              <div className="flex flex-wrap gap-3">
                <GoogleConnectTest />

                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
                >
                  <RefreshCw className={`h-4 w-4 ${verifying ? 'animate-spin' : ''}`} />
                  {verifying ? 'Doğrulanıyor...' : 'Yenile'}
                </button>

                <button
                  onClick={() => setShowDisconnect(true)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all"
                  style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                >
                  Bağlantıyı Kopar
                </button>
              </div>

              <GoogleDisconnectModal
                open={showDisconnect}
                onClose={() => setShowDisconnect(false)}
                onConfirm={handleDisconnect}
                loading={disconnecting}
              />
            </div>
          ) : (
            /* ── Bağlı değil — form göster ── */
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="mb-5">
                <h2 className="text-[15px] font-bold">Hesap Bağla</h2>
                <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  AI içerik üretimi için Google NotebookLM hesabınızın cookie bilgilerini girin.
                </p>
              </div>
              <GoogleConnectForm onConnect={handleConnect} loading={connecting} />
            </div>
          )}
        </BlurFade>
      </div>
    </div>
  )
}
