'use client'

import { useState } from 'react'
import { Award, Copy, Download, Ban, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/shared/toast'
import type { Certificate } from '../_types'

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
        className="relative w-full max-w-lg rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative px-8 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <Award className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Tamamlama Sertifikası
            </h2>
            <p className="text-[13px] text-white/70 mt-1">Devakent Hastanesi Eğitim Programı</p>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {cert.isRevoked && (
            <div
              className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'color-mix(in srgb, var(--color-error) 25%, transparent)',
              }}
            >
              <Ban className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold" style={{ color: 'var(--color-error)' }}>
                  Bu sertifika iptal edilmiş
                </p>
                {cert.revokedAt && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDate(cert.revokedAt)} tarihinde iptal edildi
                  </p>
                )}
                {cert.revocationReason && (
                  <p className="text-[11px] mt-1 italic" style={{ color: 'var(--color-text-secondary)' }}>
                    Neden: &ldquo;{cert.revocationReason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="text-center pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Bu sertifika</p>
            <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{cert.user.name}</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
            </p>
          </div>

          <div className="text-center pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Tamamlanan Eğitim</p>
            <p className="text-base font-bold">{cert.training.title}</p>
            {cert.training.category && (
              <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                {cert.training.category}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Puan</p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{cert.score}%</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Deneme</p>
              <p className="text-lg font-bold font-mono">{cert.attemptNumber}.</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Durum</p>
              <p className="text-lg font-bold" style={{ color: cert.isRevoked ? 'var(--color-error)' : cert.isExpired ? 'var(--color-error)' : 'var(--color-success)' }}>
                {cert.isRevoked ? 'İptal' : cert.isExpired ? 'Dolmuş' : 'Aktif'}
              </p>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Sertifika Kodu</span>
              <div className="flex items-center gap-2">
                <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{cert.certificateCode}</code>
                <button onClick={copyCode} aria-label="Sertifika kodunu kopyala" className="p-1 rounded hover:bg-(--color-surface-hover)">
                  <Copy className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Veriliş Tarihi</span>
              <span className="text-[13px] font-mono">{formatDate(cert.issuedAt)}</span>
            </div>
            {cert.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Geçerlilik Tarihi</span>
                <span className="text-[13px] font-mono" style={{ color: cert.isExpired ? 'var(--color-error)' : undefined }}>
                  {formatDate(cert.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {revokeMode && !cert.isRevoked && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: 'color-mix(in srgb, var(--color-error) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--color-error)' }}>
                    Sertifikayı iptal et
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    İptal edilen sertifika denetim kayıtlarında kalır, ancak &quot;geçersiz&quot; olarak işaretlenir.
                  </p>
                </div>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="İptal nedeni (en az 5 karakter)..."
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
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
                  style={{ background: 'var(--color-error)' }}
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
            <Button
              variant="outline"
              className="flex-1 gap-2 rounded-xl h-11"
              style={{ borderColor: 'var(--color-border)' }}
              onClick={onClose}
            >
              Kapat
            </Button>

            {cert.isRevoked ? (
              <button
                disabled={submitting}
                onClick={submitRestore}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold transition-colors duration-150 disabled:opacity-60"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-surface)',
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
                  border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)',
                  color: 'var(--color-error)',
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
              className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)',
              }}
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
