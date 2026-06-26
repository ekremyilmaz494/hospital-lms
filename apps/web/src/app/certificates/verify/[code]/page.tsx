'use client'

import { useParams } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { BlurFade } from '@/components/ui/blur-fade'

interface VerifyResult {
  isValid: boolean
  isRevoked: boolean
  holderName: string
  trainingTitle: string
  issuedAt: string
  expiresAt: string | null
  revokedAt: string | null
  organizationName: string | null
}

// Sertifika PDF'i ile görsel uyum için aynı navy/gold premium palet.
const NAVY = '#0b1e3f'
const NAVY_MID = '#16305a'
const GOLD = '#c9a961'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

type Status = 'valid' | 'expired' | 'revoked'

function resolveStatus(data: VerifyResult): Status {
  if (data.isRevoked) return 'revoked'
  if (!data.isValid) return 'expired'
  return 'valid'
}

const STATUS_META: Record<
  Status,
  { label: string; color: string; note?: string; icon: 'check' | 'x' | 'clock' }
> = {
  valid: { label: 'Geçerli Sertifika', color: 'var(--color-primary)', icon: 'check' },
  expired: {
    label: 'Süresi Dolmuş Sertifika',
    color: '#d97706',
    note: 'Bu sertifikanın geçerlilik süresi dolmuştur.',
    icon: 'clock',
  },
  revoked: {
    label: 'İptal Edilmiş Sertifika',
    color: 'var(--color-error)',
    note: 'Bu sertifika kurum tarafından iptal edilmiştir.',
    icon: 'x',
  },
}

function StatusIcon({ icon }: { icon: 'check' | 'x' | 'clock' }) {
  const paths: Record<string, string> = {
    check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    x: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  }
  return (
    <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon]} />
    </svg>
  )
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: valueColor ?? 'var(--color-text)' }}>
        {value}
      </p>
    </div>
  )
}

export default function CertificateVerifyPage() {
  const { code } = useParams<{ code: string }>()
  const { data, isLoading } = useFetch<VerifyResult>(`/api/certificates/verify/${code}`)

  if (isLoading) return <PageLoading />

  const notFound = !data
  const status = data ? resolveStatus(data) : null
  const meta = status ? STATUS_META[status] : null
  const pdfUrl = `/api/certificates/verify/${code}/pdf`

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <BlurFade delay={0.1}>
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl border"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        >
          {/* Premium marka başlığı — sertifika PDF'i ile aynı dil */}
          <div
            className="px-8 py-6"
            style={{
              background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})`,
              borderBottom: `2px solid ${GOLD}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${GOLD}` }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={GOLD} strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-base font-bold leading-tight text-white"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
                >
                  KLINOVAX
                </p>
                <p className="text-xs" style={{ color: GOLD }}>
                  Sertifika Doğrulama Servisi
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Bulunamadı */}
            {notFound && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div style={{ color: 'var(--color-error)' }}>
                  <StatusIcon icon="x" />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
                  Sertifika Bulunamadı
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Bu koda ait geçerli bir sertifika kaydı bulunamadı.
                </p>
              </div>
            )}

            {/* Sonuç */}
            {data && meta && (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}
                >
                  <StatusIcon icon={meta.icon} />
                </div>
                <p className="text-base font-bold" style={{ color: meta.color }}>
                  {meta.label}
                </p>
                {meta.note && (
                  <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {meta.note}
                  </p>
                )}

                <div
                  className="mt-1 w-full space-y-3 rounded-xl p-4"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <DetailRow label="Sertifika Sahibi" value={data.holderName} />
                  <DetailRow label="Eğitim" value={data.trainingTitle} />
                  {data.organizationName && <DetailRow label="Kurum" value={data.organizationName} />}
                  <div className="flex gap-6">
                    <DetailRow label="Veriliş Tarihi" value={formatDate(data.issuedAt)} />
                    {data.expiresAt && (
                      <DetailRow
                        label="Geçerlilik Tarihi"
                        value={formatDate(data.expiresAt)}
                        valueColor={status === 'expired' ? 'var(--color-error)' : undefined}
                      />
                    )}
                    {status === 'revoked' && data.revokedAt && (
                      <DetailRow label="İptal Tarihi" value={formatDate(data.revokedAt)} valueColor="var(--color-error)" />
                    )}
                  </div>
                </div>

                {/* Sertifika PDF aksiyonları */}
                <div className="mt-1 flex w-full gap-3">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})` }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Görüntüle
                  </a>
                  <a
                    href={`${pdfUrl}?download=1`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF İndir
                  </a>
                </div>
              </div>
            )}

            {/* Alt bilgi */}
            <div className="mt-6 border-t pt-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Bu doğrulama <span style={{ color: NAVY, fontWeight: 600 }}>klinovax.com</span> tarafından sağlanmaktadır.
              </p>
              <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                Kod: {code}
              </p>
            </div>
          </div>
        </div>
      </BlurFade>
    </div>
  )
}
