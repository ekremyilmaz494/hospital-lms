'use client'

import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, ShieldAlert, Lock, Upload } from 'lucide-react'
import { BRAND } from '@/lib/brand'

/**
 * On-prem lisans aktivasyon / yenileme ekranı.
 * Kilitliyken erişilebilir (middleware'de public). İki mod: lisans dosyası
 * (license.klv) yapıştır/yükle veya kapalı-ağ için offline makbuz (receipt.klr).
 * Bulut modunda bu sayfaya gelinmez (link yok); yine de nazikçe yönlendirir.
 */

interface LicenseStatus {
  mode: 'cloud' | 'onprem'
  state?: 'NO_LICENSE' | 'VALID' | 'WARN' | 'READONLY' | 'LOCKED'
  reasons?: string[]
  daysToExpiry?: number | null
  offlineDaysLeft?: number | null
  customerName?: string | null
}

const STATE_META: Record<string, { label: string; cls: string; icon: typeof ShieldCheck }> = {
  VALID: { label: 'Lisans Aktif', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  WARN: { label: 'Uyarı', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: ShieldAlert },
  READONLY: { label: 'Salt-Okunur (Süre Doldu)', cls: 'text-red-700 bg-red-50 border-red-200', icon: Lock },
  LOCKED: { label: 'Kilitli', cls: 'text-red-700 bg-red-50 border-red-200', icon: Lock },
  NO_LICENSE: { label: 'Lisans Yok', cls: 'text-slate-700 bg-slate-50 border-slate-200', icon: KeyRound },
}

export default function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [licenseText, setLicenseText] = useState('')
  const [receiptText, setReceiptText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/license/status', { cache: 'no-store' })
      if (res.ok) setStatus((await res.json()) as LicenseStatus)
    } catch {
      /* sessiz */
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const submit = async (payload: { licenseJwt: string } | { receiptJwt: string }) => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string; customerName?: string; phoneHome?: string }
      if (!res.ok) {
        setError(data.error ?? 'Aktivasyon başarısız.')
        return
      }
      setSuccess(
        'licenseJwt' in payload
          ? `Lisans etkinleştirildi${data.customerName ? ` — ${data.customerName}` : ''}. Panele yönlendiriliyorsunuz…`
          : 'Offline makbuz yüklendi. Panele yönlendiriliyorsunuz…',
      )
      setLicenseText('')
      setReceiptText('')
      // Kilit açıldıysa sentinel çerezi login'de tazelenir; tam sayfa reload ile
      // middleware yeni durumu görsün.
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  const meta = status?.state ? STATE_META[status.state] : null
  const StateIcon = meta?.icon ?? KeyRound

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sistem Lisansı</h1>
          <p className="text-sm text-muted-foreground">{BRAND.fullName}</p>
        </div>
      </div>

      {status?.mode === 'cloud' && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Bu kurulum bulut modunda çalışıyor; ayrı bir lisans etkinleştirmesi gerekmez.
        </div>
      )}

      {status?.mode === 'onprem' && (
        <>
          {meta && (
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${meta.cls}`}>
              <StateIcon className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">{meta.label}</span>
                {status.customerName && <span> · {status.customerName}</span>}
                {typeof status.daysToExpiry === 'number' && status.state !== 'NO_LICENSE' && (
                  <span> · {status.daysToExpiry >= 0 ? `${status.daysToExpiry} gün kaldı` : `${Math.abs(status.daysToExpiry)} gün önce doldu`}</span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
              <Upload className="h-4 w-4" /> Lisans Dosyası Yükle
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Klinovax&apos;tan aldığınız <code className="rounded bg-muted px-1">license.klv</code> içeriğini yapıştırın.
            </p>
            <textarea
              value={licenseText}
              onChange={(e) => setLicenseText(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder="eyJhbGciOiJFZERTQSJ9…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || licenseText.trim().length < 20}
              onClick={() => void submit({ licenseJwt: licenseText.trim() })}
              style={{ backgroundColor: '#0d9668', color: '#ffffff' }}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Etkinleştiriliyor…' : 'Lisansı Etkinleştir'}
            </button>
          </div>

          <details className="rounded-2xl border border-border bg-card p-6">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Kapalı ağ (internet yok) — Offline Makbuz Yükle
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              İnternet erişimi yoksa Klinovax&apos;ın gönderdiği <code className="rounded bg-muted px-1">receipt.klr</code> içeriğini yapıştırın.
            </p>
            <textarea
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="eyJhbGciOiJFZERTQSJ9…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || receiptText.trim().length < 20}
              onClick={() => void submit({ receiptJwt: receiptText.trim() })}
              className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {busy ? 'Yükleniyor…' : 'Makbuzu Yükle'}
            </button>
          </details>

          <p className="text-center text-xs text-muted-foreground">
            Yardım için: {BRAND.name} · destek ekibinizle iletişime geçin.
          </p>
        </>
      )}
    </div>
  )
}
