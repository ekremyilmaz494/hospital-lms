'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'

/**
 * On-prem lisans durum banner'ı + gate.
 * - WARN → sarı uyarı bandı (bitişe kalan gün / offline uyarısı)
 * - READONLY → kırmızı "salt-okunur" bandı
 * - LOCKED / NO_LICENSE → /license'a yönlendir (mid-session kilit kapanışı;
 *   API kapısı zaten tüm veriyi 403'ler, bu UX yönlendirmesidir)
 * Bulut modunda ({ mode: 'cloud' }) hiçbir şey render etmez.
 */

interface LicenseStatus {
  mode: 'cloud' | 'onprem'
  state?: 'NO_LICENSE' | 'VALID' | 'WARN' | 'READONLY' | 'LOCKED'
  reasons?: string[]
  daysToExpiry?: number | null
  offlineDaysLeft?: number | null
}

export function LicenseBanner() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/license/status', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as LicenseStatus
        if (cancelled) return
        if (data.mode === 'onprem' && (data.state === 'LOCKED' || data.state === 'NO_LICENSE')) {
          window.location.href = '/license'
          return
        }
        setStatus(data)
      } catch {
        /* offline/geçici — sessiz geç */
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  if (!status || status.mode !== 'onprem') return null
  if (status.state !== 'WARN' && status.state !== 'READONLY') return null

  if (status.state === 'READONLY') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200"
      >
        <Lock className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">
          Sistem lisansının süresi doldu — şu an yalnızca görüntüleme yapılabilir. Yeni eğitim,
          sınav veya kayıt oluşturulamaz. Lütfen kurum yöneticinizle iletişime geçin.
        </p>
      </div>
    )
  }

  // WARN
  const offline = status.reasons?.includes('offline_warning')
  const days = status.daysToExpiry
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium">
        {typeof days === 'number' && days >= 0
          ? `Sistem lisansının süresi ${days} gün içinde dolacak. Kesintisiz kullanım için lütfen yenileyin.`
          : offline
            ? 'Lisans doğrulaması bir süredir yapılamadı. İnternet bağlantısını kontrol edin; süre dolarsa sistem kilitlenir.'
            : 'Sistem lisansı uyarısı — lütfen kurum yöneticinizle iletişime geçin.'}
      </p>
    </div>
  )
}
