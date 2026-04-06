'use client'

import { AlertTriangle, XCircle } from 'lucide-react'
import type { SubscriptionStatusType } from '@/lib/subscription-guard'

interface SubscriptionBannerProps {
  status: SubscriptionStatusType
  daysLeft: number
}

/**
 * Abonelik durumu icin uyari banner'i.
 * Grace period ve expired durumlarinda gosterilir.
 */
export function SubscriptionBanner({ status, daysLeft }: SubscriptionBannerProps) {
  if (status !== 'grace_period' && status !== 'expired' && status !== 'suspended') {
    return null
  }

  if (status === 'grace_period') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
      >
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">
          Aboneliginiz {daysLeft} gun icinde sona erecek. Hizmet kesintisi yasamamamak icin
          lutfen aboneliginizi yenileyin.
        </p>
      </div>
    )
  }

  // expired veya suspended
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200"
    >
      <XCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium">
        Aboneliginiz sona ermistir. Yeni kayit olusturma kisitlanmistir.
        Lutfen aboneliginizi yenileyerek hizmete devam edin.
      </p>
    </div>
  )
}
