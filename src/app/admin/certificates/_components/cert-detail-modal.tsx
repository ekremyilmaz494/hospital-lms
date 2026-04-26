'use client'

import { useState } from 'react'
import { Award, Copy, Download, Ban, RotateCcw, AlertTriangle, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/shared/toast'
import type { Certificate } from '../_types'

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
}

const MIN_REVOKE_REASON = 5

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  cert: Certificate
  onClose: () => void
  onMutated: () => void
  onDownload: () => void
  isPdfPending: boolean
}

export function CertDetailModal({ cert, onClose, onMutated, onDownload, isPdfPending }: Props) {
  const { toast } = useToast()
  const [revokeMode, setRevokeMode] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(cert.certificateCode).then(() => {
      toast('Sertifika kodu kopyalandı', 'success')
    })
  }

  const submitRevoke = async () => {
    if (reason.trim().length < MIN_REVOKE_REASON) {
      toast(`İptal nedeni en az ${MIN_REVOKE_REASON} karakter olmalıdır`, 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/certificates/${cert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', reason: reason.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(body.error ?? 'Sertifika iptal edilemedi', 'error')
        return
      }
      toast('Sertifika iptal edildi', 'success')
      onMutated()
    } finally {
      setSubmitting(false)
    }
  }

  const submitRestore = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/certificates/${cert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(body.error ?? 'Sertifika geri alınamadı', 'error')
        return
      }
      toast('Sertifika yeniden aktif edildi', 'success')
      onMutated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div
        className="relative w-full max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 14,
          boxShadow: K.SHADOW_CARD,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative px-8 pt-8 pb-6 text-center"
          style={{ background: K.PRIMARY_LIGHT, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
        >
          <div className="relative">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4"
              style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}` }}
            >
              <Award className="h-8 w-8" style={{ color: K.PRIMARY }} />
            </div>
            <h2
              style={{ fontSize: 20, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}
            >
              Tamamlama Sertifikası
            </h2>
            <p className="text-[13px] mt-1" style={{ color: K.TEXT_SECONDARY }}>Devakent Hastanesi Eğitim Programı</p>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {cert.isRevoked && (
            <div
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{
                background: K.ERROR_BG,
                border: `1px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <Ban className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#b91c1c' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold" style={{ color: '#b91c1c' }}>
                  Bu sertifika iptal edilmiş
                </p>
                {cert.revokedAt && (
                  <p className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
                    {formatDate(cert.revokedAt)} tarihinde iptal edildi
                  </p>
                )}
                {cert.revocationReason && (
                  <p className="text-[11px] mt-1 italic" style={{ color: K.TEXT_SECONDARY }}>
                    Neden: &ldquo;{cert.revocationReason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="text-center pb-5" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: K.TEXT_MUTED }}>Bu sertifika</p>
            <p style={{ fontSize: 20, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>{cert.user.name}</p>
            <p className="text-[13px] mt-1" style={{ color: K.TEXT_SECONDARY }}>
              {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
            </p>
          </div>

          <div className="text-center pb-5" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: K.TEXT_MUTED }}>Tamamlanan Eğitim</p>
            <p className="text-base font-bold" style={{ color: K.TEXT_PRIMARY }}>{cert.training.title}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
              {cert.training.category && (
                <span
                  className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}
                >
                  {cert.training.category}
                </span>
              )}
              {cert.training.isArchived && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: K.BG, color: K.TEXT_MUTED }}
                  title="Eğitim arşivlenmiş — sertifika geçerliliğini korur"
                >
                  <Archive className="h-3 w-3" /> Arşivlenmiş Eğitim
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center rounded-xl p-3" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: K.TEXT_MUTED }}>Puan</p>
              <p className="text-lg font-bold font-mono" style={{ color: K.PRIMARY }}>{cert.score}%</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: K.TEXT_MUTED }}>Deneme</p>
              <p className="text-lg font-bold font-mono" style={{ color: K.TEXT_PRIMARY }}>{cert.attemptNumber}.</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: K.TEXT_MUTED }}>Durum</p>
              <p className="text-lg font-bold" style={{ color: cert.isRevoked ? '#b91c1c' : cert.isExpired ? '#b91c1c' : K.SUCCESS }}>
                {cert.isRevoked ? 'İptal' : cert.isExpired ? 'Dolmuş' : 'Aktif'}
              </p>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: K.TEXT_MUTED }}>Sertifika Kodu</span>
              <div className="flex items-center gap-2">
                <code className="text-[13px] font-mono font-bold" style={{ color: K.PRIMARY }}>{cert.certificateCode}</code>
                <button
                  onClick={copyCode}
                  aria-label="Sertifika kodunu kopyala"
                  className="p-1 rounded transition-colors"
                  onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Copy className="h-3.5 w-3.5" style={{ color: K.TEXT_MUTED }} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: K.TEXT_MUTED }}>Veriliş Tarihi</span>
              <span className="text-[13px] font-mono" style={{ color: K.TEXT_SECONDARY }}>{formatDate(cert.issuedAt)}</span>
            </div>
            {cert.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: K.TEXT_MUTED }}>Geçerlilik Tarihi</span>
                <span
                  className="text-[13px] font-mono"
                  style={{ color: cert.isExpired ? '#b91c1c' : K.TEXT_SECONDARY }}
                >
                  {formatDate(cert.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {revokeMode && !cert.isRevoked && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: K.ERROR_BG,
                border: `1px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#b91c1c' }} />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#b91c1c' }}>
                    Sertifikayı iptal et
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
                    İptal edilen sertifika denetim kayıtlarında kalır, ancak &quot;geçersiz&quot; olarak işaretlenir.
                  </p>
                </div>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="İptal nedeni (en az 5 karakter)..."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2"
                style={{
                  background: K.SURFACE,
                  border: `1px solid ${K.BORDER}`,
                  color: K.TEXT_PRIMARY,
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 rounded-lg text-[12px]"
                  onClick={() => { setRevokeMode(false); setReason('') }}
                  disabled={submitting}
                >
                  Vazgeç
                </Button>
                <button
                  onClick={submitRevoke}
                  disabled={submitting || reason.trim().length < MIN_REVOKE_REASON}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg h-9 text-[12px] font-semibold text-white disabled:opacity-60 transition-opacity duration-150"
                  style={{ background: K.ERROR }}
                >
                  {submitting ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  İptal Et
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold transition-colors duration-150"
              style={{
                background: K.SURFACE,
                border: `1px solid ${K.BORDER}`,
                color: K.TEXT_SECONDARY,
              }}
              onClick={onClose}
            >
              Kapat
            </button>

            {cert.isRevoked ? (
              <button
                disabled={submitting}
                onClick={submitRestore}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold transition-colors duration-150 disabled:opacity-60"
                style={{
                  border: `1px solid ${K.BORDER}`,
                  color: K.TEXT_PRIMARY,
                  background: K.SURFACE,
                }}
              >
                {submitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Geri Al
              </button>
            ) : !revokeMode ? (
              <button
                onClick={() => setRevokeMode(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold transition-colors duration-150"
                style={{
                  border: `1px solid ${K.BORDER}`,
                  color: '#b91c1c',
                  background: 'transparent',
                }}
              >
                <Ban className="h-4 w-4" />
                İptal Et
              </button>
            ) : null}

            <button
              disabled={isPdfPending}
              aria-label="Sertifikayı PDF olarak indir"
              onClick={onDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white disabled:opacity-60 transition-colors duration-150"
              style={{
                background: K.PRIMARY,
              }}
              onMouseEnter={(e) => { if (!isPdfPending) e.currentTarget.style.background = K.PRIMARY_HOVER }}
              onMouseLeave={(e) => { e.currentTarget.style.background = K.PRIMARY }}
            >
              {isPdfPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  PDF İndir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
