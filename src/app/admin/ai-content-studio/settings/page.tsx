'use client'

// AI İçerik Stüdyosu — Google Hesap Ayarları
// Google NotebookLM hesap bağlama, doğrulama ve bağlantı kesme yönetimi

import { useState } from 'react'
import { ArrowLeft, Settings, Shield } from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/components/shared/toast'

import { GoogleConnectForm } from '../components/google-connect-form'
import { GoogleConnectStatus } from '../components/google-connect-status'
import { GoogleDisconnectModal } from '../components/google-disconnect-modal'
import type { GoogleConnectionStatus } from '../types'

export default function AIContentStudioSettingsPage() {
  const { toast } = useToast()
  const { data: connectionStatus, isLoading, refetch } = useFetch<GoogleConnectionStatus>(
    '/api/admin/ai-content-studio/auth/status',
  )

  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  const isConnected = connectionStatus?.connected === true

  // ── Bağlantı Kur ──
  const handleConnect = async (email: string, browser?: string) => {
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch('/api/admin/ai-content-studio/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, browser }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Bağlantı başarısız')
      }
      toast('Google hesabı başarıyla bağlandı', 'success')
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bağlantı hatası'
      setConnectError(msg)
      toast(msg, 'error')
    } finally {
      setConnecting(false)
    }
  }

  // ── Bağlantı Doğrula ──
  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/auth/verify', { method: 'POST' })
      const data = await res.json()
      if (data.valid) {
        toast('Bağlantı geçerli', 'success')
      } else {
        toast('Bağlantı süresi dolmuş. Lütfen yeniden bağlanın.', 'error')
      }
      refetch()
    } catch {
      toast('Doğrulama başarısız', 'error')
    } finally {
      setVerifying(false)
    }
  }

  // ── Bağlantı Kes ──
  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/auth/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Bağlantı kesilemedi')
      toast('Google hesabı bağlantısı kesildi', 'success')
      setShowDisconnectModal(false)
      refetch()
    } catch {
      toast('Bağlantı kesme başarısız', 'error')
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
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            AI İçerik Stüdyosu
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' }}
            >
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                AI İçerik Stüdyosu Ayarları
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Google NotebookLM hesap bağlantısı ve yapılandırma
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="max-w-2xl space-y-6">
        {/* Bağlantı Durumu Kartı */}
        <BlurFade delay={0.03}>
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2
              className="mb-4 text-[15px] font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            >
              Google Hesap Bağlantısı
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: 'var(--color-primary)' }}
                />
              </div>
            ) : isConnected && connectionStatus ? (
              <GoogleConnectStatus
                connected={true}
                email={connectionStatus.email}
                status={connectionStatus.status}
                lastVerifiedAt={connectionStatus.lastVerifiedAt}
                onVerify={handleVerify}
                onDisconnect={() => setShowDisconnectModal(true)}
                verifying={verifying}
              />
            ) : (
              <GoogleConnectForm
                onConnect={handleConnect}
                connecting={connecting}
                error={connectError}
              />
            )}
          </div>
        </BlurFade>

        {/* Güvenlik Bilgi Kartı */}
        <BlurFade delay={0.05}>
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: 'var(--color-info-bg)' }}
              >
                <Shield className="h-4.5 w-4.5" style={{ color: 'var(--color-info)' }} />
              </div>
              <h2
                className="text-[15px] font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                Güvenlik Bilgileri
              </h2>
            </div>
            <ul className="space-y-2.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-success)' }}
                />
                Google hesap bilgileriniz AES-256-GCM şifreleme ile korunur.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-success)' }}
                />
                Bağlantınızı istediğiniz zaman kaldırabilirsiniz.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-success)' }}
                />
                Bağlantı bilgileri yalnızca bu hastane için geçerlidir.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-warning)' }}
                />
                Google cookie&apos;leri belirli süre sonra geçerliliğini yitirir — bu durumda yeniden bağlanmanız gerekir.
              </li>
            </ul>
          </div>
        </BlurFade>
      </div>

      {/* Bağlantı Kesme Modal */}
      <GoogleDisconnectModal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        onConfirm={handleDisconnect}
        disconnecting={disconnecting}
      />
    </div>
  )
}
