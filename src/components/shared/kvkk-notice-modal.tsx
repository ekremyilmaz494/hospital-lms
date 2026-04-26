'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth-store'

// Klinova palette (matches /auth/login)
const INK = '#063a26'        // deep emerald-ink
const CREAM = '#f0fdf4'      // emerald cream
const RULE = '#a7f3d0'       // light emerald border
const GOLD = '#10b981'       // emerald primary
const INK_SOFT = '#475569'   // slate

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
  const [apiError, setApiError] = useState<string | null>(null)
  const { setUserIfChanged } = useAuthStore()

  async function handleAcknowledge() {
    if (!accepted || loading || rejecting) return
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/auth/kvkk-acknowledge', { method: 'POST' })
      if (!res.ok) {
        // 429 veya diğer hata: modal açık kalsın, mesaj göster → kullanıcı tekrar
        // denesin. Önceden sessizce onAcknowledge() çağırıyorduk, navigasyon oluyor
        // ama JWT güncel olmadığı için middleware tekrar modala gönderiyor = loop.
        const body = await res.json().catch(() => ({}))
        const msg = res.status === 429
          ? 'Çok fazla deneme. 1 saat içinde tekrar deneyebilirsiniz veya sayfayı yenileyin.'
          : (body.error ?? 'Kayıt başarısız oldu, lütfen tekrar deneyin.')
        setApiError(msg)
        setLoading(false)
        return
      }
      setUserIfChanged({ kvkkNoticeAcknowledgedAt: new Date().toISOString() })
    } catch {
      setApiError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      setLoading(false)
      return
    }
    setOpen(false)
    onAcknowledge?.()
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
        if (next) setOpen(true)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[480px] p-0 overflow-hidden gap-0 max-h-[min(720px,85dvh)] flex flex-col"
        style={{
          background: '#fff',
          border: `1.5px solid ${RULE}`,
          borderLeft: `6px solid ${GOLD}`,
          borderRadius: 0,
          boxShadow: '0 32px 64px -12px rgba(6, 58, 38, 0.32)',
        }}
      >
        <style>{`
          .kvkk-display { font-family: var(--font-plus-jakarta-sans), serif; }
          .kvkk-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        `}</style>

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="kvkk-mono text-[10px] tracking-[0.32em]" style={{ color: GOLD }}>
            № 05 · YASAL BİLGİLENDİRME
          </div>
          <DialogTitle
            className="kvkk-display mt-2 leading-[1.05] tracking-tight"
            style={{ color: INK, fontSize: '1.45rem', fontWeight: 600 }}
          >
            KVKK <span style={{ fontStyle: 'italic', color: GOLD }}>Aydınlatma Metni.</span>
          </DialogTitle>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: INK_SOFT }}>
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, sisteme giriş yapmadan önce
            kişisel verilerinizin nasıl işlendiği hakkında bilgilendirilmeniz gerekmektedir.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0" style={{ borderTop: `1px solid ${RULE}` }}>
          <InfoRow
            no="I"
            label="İŞLEME AMACI"
            description={
              <>
                Ad-soyad, e-posta, departman, eğitim ve sınav kayıtlarınız yalnızca{' '}
                <strong style={{ color: INK }}>personel eğitim süreçlerinin yönetimi</strong> amacıyla işlenir.
              </>
            }
          />
          <InfoRow
            no="II"
            label="SAKLAMA & GÜVENLİK"
            description={
              <>
                Verileriniz Supabase, AWS ve Vercel&apos;in <strong style={{ color: INK }}>AB sunucularında</strong>,
                KVKK m.9 uyarınca şifrelenerek saklanır.
              </>
            }
          />
          <InfoRow
            no="III"
            label="HAKLARINIZ"
            last
            description={
              <>
                KVKK m.11 kapsamında verilerinize <strong style={{ color: INK }}>erişim, düzeltme ve silme</strong>{' '}
                haklarına sahipsiniz.
              </>
            }
          />

          {/* External link callout */}
          <div
            className="mt-4 flex items-start gap-3 px-4 py-2.5"
            style={{ background: CREAM, borderLeft: `3px solid ${GOLD}` }}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
            <p className="text-[12.5px] leading-relaxed" style={{ color: INK_SOFT }}>
              Ayrıntılı bilgi için{' '}
              <Link
                href="/kvkk"
                target="_blank"
                className="font-semibold underline underline-offset-2 transition-colors hover:opacity-80"
                style={{ color: INK }}
              >
                KVKK Aydınlatma Metni&apos;nin tamamını
              </Link>{' '}
              inceleyebilirsiniz.
            </p>
          </div>

          {/* Consent checkbox */}
          <label
            className="mt-4 flex items-start gap-3 cursor-pointer px-4 py-3 transition-colors duration-200"
            style={{
              background: accepted ? CREAM : '#fafafa',
              border: accepted ? `1.5px solid ${GOLD}` : `1.5px solid ${RULE}`,
            }}
            onClick={() => setAccepted((v) => !v)}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={accepted}
              onClick={(e) => {
                e.stopPropagation()
                setAccepted((v) => !v)
              }}
              className="w-3 h-3 shrink-0 mt-1 flex items-center justify-center transition-colors duration-200"
              style={{
                background: accepted ? INK : CREAM,
                border: accepted ? `1px solid ${INK}` : `1px solid ${RULE}`,
              }}
            >
              {accepted && (
                <span
                  style={{
                    width: 3,
                    height: 6,
                    borderStyle: 'solid',
                    borderColor: GOLD,
                    borderWidth: '0 1.5px 1.5px 0',
                    transform: 'translateY(-1px) rotate(45deg)',
                    display: 'block',
                  }}
                />
              )}
            </button>
            <span className="text-[13px] leading-relaxed select-none" style={{ color: INK }}>
              KVKK Aydınlatma Metni&apos;ni{' '}
              <strong style={{ color: INK }}>okudum ve anladım</strong>; kişisel verilerimin belirtilen amaç
              doğrultusunda işlenmesine onay veriyorum.
            </span>
          </label>
        </div>

        {/* API error banner */}
        {apiError && (
          <div
            className="px-6 py-2 text-[12.5px] shrink-0"
            style={{ background: '#fdf2ee', color: '#992f1d', borderTop: `1px solid ${RULE}`, borderLeft: '3px solid #b3261e' }}
          >
            {apiError}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-6 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0"
          style={{ background: CREAM, borderTop: `1px solid ${RULE}` }}
        >
          <button
            type="button"
            onClick={handleReject}
            disabled={loading || rejecting}
            className="kvkk-mono inline-flex items-center justify-center gap-2 px-5 text-[11px] tracking-[0.24em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:bg-white"
            style={{
              height: 42,
              background: 'transparent',
              color: INK,
              border: `1.5px solid ${RULE}`,
            }}
          >
            {rejecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ÇIKIŞ YAPILIYOR…
              </>
            ) : (
              <>REDDET & ÇIKIŞ</>
            )}
          </button>

          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={!accepted || loading || rejecting}
            className="group kvkk-mono relative inline-flex items-center justify-center gap-3 px-7 text-[12px] tracking-[0.28em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: 42,
              background: INK,
              color: '#ecfdf5',
              border: `1.5px solid ${INK}`,
              boxShadow:
                accepted && !loading && !rejecting
                  ? `0 0 0 1px ${GOLD}, 0 0 0 3px ${CREAM}, 0 0 0 4px #10b98155`
                  : 'none',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: GOLD }} />
                <span>KAYDEDİLİYOR…</span>
              </>
            ) : (
              <>
                <span>KABUL EDİYORUM</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: GOLD }}
                />
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({
  no,
  label,
  description,
  last = false,
}: {
  no: string
  label: string
  description: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="grid grid-cols-[32px_1fr] gap-3 items-start py-2.5"
      style={!last ? { borderBottom: `1px solid ${RULE}` } : undefined}
    >
      <div
        className="kvkk-display text-xl pt-0.5"
        style={{ color: GOLD, fontStyle: 'italic', fontWeight: 500, lineHeight: 1 }}
      >
        {no}
      </div>
      <div>
        <div className="kvkk-mono text-[10px] tracking-[0.28em] mb-1.5" style={{ color: INK }}>
          {label}
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
          {description}
        </p>
      </div>
    </div>
  )
}
