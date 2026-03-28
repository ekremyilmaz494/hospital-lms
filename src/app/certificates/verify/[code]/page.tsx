'use client'

import { useParams } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { BlurFade } from '@/components/ui/blur-fade'

interface VerifyResult {
  isValid: boolean
  holderName: string
  trainingTitle: string
  issuedAt: string
  expiresAt: string | null
  organizationName: string | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function CertificateVerifyPage() {
  const { code } = useParams<{ code: string }>()
  const { data, isLoading, error } = useFetch<VerifyResult>(
    `/api/certificates/verify/${code}`
  )

  if (isLoading) return <PageLoading />

  const notFound = !data && !isLoading

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <BlurFade delay={0.1}>
        <div
          className="w-full max-w-md rounded-2xl border p-8"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
              }}
            >
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h1
              className="text-lg font-bold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
            >
              Sertifika Dogrulama
            </h1>
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Kod: {code}
            </p>
          </div>

          {/* Not found */}
          {notFound && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--color-error)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--color-error)' }}
              >
                Sertifika bulunamadi
              </p>
              <p
                className="text-xs text-center"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Bu koda ait gecerli bir sertifika kaydi bulunamadi.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--color-error)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--color-error)' }}
              >
                Dogrulama hatasi
              </p>
            </div>
          )}

          {/* Valid certificate */}
          {data && data.isValid && (
            <div className="flex flex-col items-center gap-4 py-4">
              <svg
                className="h-14 w-14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--color-primary)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                Gecerli Sertifika
              </p>

              <div
                className="w-full rounded-xl p-4 space-y-3"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Sertifika Sahibi
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {data.holderName}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Egitim
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {data.trainingTitle}
                  </p>
                </div>
                {data.organizationName && (
                  <div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Kurum
                    </p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {data.organizationName}
                    </p>
                  </div>
                )}
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Verilis Tarihi
                    </p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {formatDate(data.issuedAt)}
                    </p>
                  </div>
                  {data.expiresAt && (
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Gecerlilik Tarihi
                      </p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {formatDate(data.expiresAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expired certificate */}
          {data && !data.isValid && (
            <div className="flex flex-col items-center gap-4 py-4">
              <svg
                className="h-14 w-14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--color-error)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--color-error)' }}
              >
                Suresi Dolmus Sertifika
              </p>
              <p
                className="text-xs text-center"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Bu sertifikanin gecerlilik suresi dolmustur.
              </p>

              <div
                className="w-full rounded-xl p-4 space-y-3"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Sertifika Sahibi
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {data.holderName}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Egitim
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {data.trainingTitle}
                  </p>
                </div>
                {data.expiresAt && (
                  <div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Bitis Tarihi
                    </p>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-error)' }}
                    >
                      {formatDate(data.expiresAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  )
}
