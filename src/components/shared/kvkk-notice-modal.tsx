'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ExternalLink, Database, Lock, UserCheck, Loader2, Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth-store'

/**
 * KVKK Aydınlatma Metni Bildirimi Modalı
 *
 * - onAcknowledge: "Kabul Ediyorum" tıklandığında. DB'ye kayıt sonrası çağrılır.
 * - onReject: "Reddet ve Çıkış Yap" tıklandığında. Çağıran tarafın signOut etmesi gerekir.
 *
 * Modal ESC / backdrop ile kapatılamaz — kullanıcı açık şekilde bir seçim yapmalı.
 */
export function KvkkNoticeModal({
  onAcknowledge,
  onReject,
}: {
  onAcknowledge?: () => void
  onReject?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const { setUserIfChanged } = useAuthStore()

  async function handleAcknowledge() {
    if (!accepted || loading || rejecting) return
    setLoading(true)
    try {
      await fetch('/api/auth/kvkk-acknowledge', { method: 'POST' })
      setUserIfChanged({ kvkkNoticeAcknowledgedAt: new Date().toISOString() })
    } catch {
      // Devam — kayıt başarısız olsa da kullanıcı onay verdiği için akış sürer
    } finally {
      setOpen(false)
      onAcknowledge?.()
    }
  }

  async function handleReject() {
    if (loading || rejecting) return
    setRejecting(true)
    try {
      await onReject?.()
    } finally {
      setOpen(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Backdrop / ESC ile kapanmaya izin verme — sadece açık button aksiyonu kapatabilir
        if (next) setOpen(true)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl p-0 overflow-hidden gap-0 border-0 max-h-[92dvh] flex flex-col"
        style={{
          background: 'var(--color-surface)',
          boxShadow: '0 32px 64px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px var(--color-border)',
        }}
      >
        {/* Decorative gradient header */}
        <div
          className="relative px-5 md:px-7 pt-5 md:pt-7 pb-4 md:pb-5 overflow-hidden shrink-0"
          style={{
            background:
              'linear-gradient(135deg, var(--brand-50) 0%, color-mix(in srgb, var(--brand-100) 60%, var(--color-surface)) 100%)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--brand-400), transparent 70%)' }}
          />

          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))',
                  boxShadow: '0 8px 20px color-mix(in srgb, var(--brand-600) 30%, transparent)',
                }}
              >
                <Shield className="h-5 w-5 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Yasal Bilgilendirme
                </p>
                <DialogTitle
                  className="text-lg md:text-xl font-bold leading-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  KVKK Aydınlatma Metni
                </DialogTitle>
              </div>
            </div>

            <p
              className="text-[13px] leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, sisteme giriş yapmadan önce kişisel
              verilerinizin nasıl işlendiği hakkında bilgilendirilmeniz gerekmektedir.
            </p>
          </DialogHeader>
        </div>

        {/* Body — three key points */}
        <div className="px-5 md:px-7 py-5 md:py-6 space-y-3.5 md:space-y-4 overflow-y-auto flex-1 min-h-0">
          <InfoRow
            icon={<Database className="w-4 h-4" />}
            title="İşleme Amacı"
            description={
              <>
                Ad-soyad, e-posta, departman, eğitim ve sınav kayıtlarınız yalnızca{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  personel eğitim süreçlerinin yönetimi
                </strong>{' '}
                amacıyla işlenir.
              </>
            }
          />
          <InfoRow
            icon={<Lock className="w-4 h-4" />}
            title="Saklama ve Güvenlik"
            description={
              <>
                Verileriniz Supabase, AWS ve Vercel&apos;in{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>AB sunucularında</strong>, KVKK m.9
                uyarınca şifrelenerek saklanır.
              </>
            }
          />
          <InfoRow
            icon={<UserCheck className="w-4 h-4" />}
            title="Haklarınız"
            description={
              <>
                KVKK m.11 kapsamında verilerinize{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  erişim, düzeltme ve silme
                </strong>{' '}
                haklarına sahipsiniz.
              </>
            }
          />

          <div
            className="rounded-xl p-3 flex items-start gap-2.5 mt-4"
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
            }}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Ayrıntılı bilgi için{' '}
              <Link
                href="/kvkk"
                target="_blank"
                className="font-semibold underline underline-offset-2 transition-colors duration-150 hover:opacity-80"
                style={{ color: 'var(--brand-700)' }}
              >
                KVKK Aydınlatma Metni&apos;nin tamamını
              </Link>{' '}
              inceleyebilirsiniz.
            </p>
          </div>

          {/* Consent checkbox */}
          <label
            className="flex items-start gap-3 cursor-pointer rounded-2xl p-4 transition-[background,border-color] duration-200"
            style={{
              background: accepted
                ? 'color-mix(in srgb, var(--brand-50) 80%, var(--color-surface))'
                : 'var(--color-surface-hover)',
              border: accepted
                ? '1px solid var(--brand-300)'
                : '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={accepted}
              onClick={() => setAccepted((v) => !v)}
              className="w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center transition-[background,border-color] duration-200"
              style={{
                background: accepted ? 'var(--color-primary)' : 'var(--color-surface)',
                border: accepted ? '1px solid var(--color-primary)' : '1.5px solid var(--color-border-hover)',
                boxShadow: accepted
                  ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)'
                  : 'none',
              }}
            >
              {accepted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
            </button>
            <span
              className="text-[13px] leading-relaxed select-none"
              style={{ color: 'var(--color-text-primary)' }}
              onClick={() => setAccepted((v) => !v)}
            >
              KVKK Aydınlatma Metni&apos;ni{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>okudum ve anladım</strong>; kişisel
              verilerimin belirtilen amaç doğrultusunda işlenmesine onay veriyorum.
            </span>
          </label>
        </div>

        {/* Footer — sticky on mobile */}
        <div
          className="px-5 md:px-7 py-4 md:py-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0"
          style={{
            background: 'var(--color-surface-hover)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <button
            type="button"
            onClick={handleReject}
            disabled={loading || rejecting}
            className="inline-flex items-center justify-center gap-2 rounded-xl h-11 px-5 text-[13px] font-semibold transition-[background,border-color,opacity] disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:bg-[var(--color-surface)]"
            style={{
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {rejecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Çıkış yapılıyor...
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Reddet ve Çıkış Yap
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={!accepted || loading || rejecting}
            className="inline-flex items-center justify-center gap-2 rounded-xl h-11 px-6 text-[13px] font-semibold text-white transition-[transform,box-shadow,opacity] disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))',
              boxShadow: accepted && !loading
                ? '0 10px 24px color-mix(in srgb, var(--brand-600) 35%, transparent)'
                : 'none',
              border: 'none',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" strokeWidth={2.5} />
                Kabul Ediyorum
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-xl flex items-center justify-center"
        style={{
          background: 'var(--brand-50)',
          color: 'var(--brand-700)',
          border: '1px solid var(--brand-100)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p
          className="text-[13px] font-bold mb-0.5"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>
    </div>
  )
}
