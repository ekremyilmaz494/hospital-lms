'use client'

import { useMemo, useCallback } from 'react'
import { useFetch } from '@/hooks/use-fetch'

/** Ozellik isimleri (sunucu tarafindaki FeatureName ile eslesir) */
type FeatureName =
  | 'aiContentStudio'
  | 'scormSupport'
  | 'hisIntegration'
  | 'advancedReports'
  | 'ssoSupport'
  | 'competencyModule'
  | 'accreditationModule'
  | 'bulkImport'
  | 'customCertificates'

/** Plan limitleri */
type LimitName = 'maxStaff' | 'maxTrainings' | 'maxStorageGb'

interface PlanFeatures {
  aiContentStudio: boolean
  scormSupport: boolean
  hisIntegration: boolean
  advancedReports: boolean
  ssoSupport: boolean
  competencyModule: boolean
  accreditationModule: boolean
  bulkImport: boolean
  customCertificates: boolean
}

interface PlanLimits {
  maxStaff: { current: number; max: number }
  maxTrainings: { current: number; max: number }
  maxStorageGb: { current: number; max: number }
}

interface SubscriptionStatusResponse {
  plan: {
    id: string
    name: string
    slug: string
  } | null
  features: PlanFeatures
  limits: PlanLimits
  status: string
}

interface UseSubscriptionReturn {
  /** Aktif plan bilgisi */
  plan: SubscriptionStatusResponse['plan']
  /** Plan ozellik flag'leri */
  features: PlanFeatures
  /** Plan limitleri (mevcut kullanim ve maksimum) */
  limits: PlanLimits
  /** Abonelik durumu (active, trial, expired vb.) */
  status: string
  /** Veri yukleniyor mu */
  isLoading: boolean
  /** Hata mesaji */
  error: string | null
  /** Belirtilen ozelligi kullanip kullanamayacagini kontrol eder */
  canUse: (feature: FeatureName) => boolean
  /** Belirtilen limitin asimina ulasilip ulasilmadigini kontrol eder */
  isAtLimit: (limit: LimitName) => boolean
  /** Veriyi yeniden yukle */
  refetch: () => void
}

const DEFAULT_FEATURES: PlanFeatures = {
  aiContentStudio: false,
  scormSupport: false,
  hisIntegration: false,
  advancedReports: false,
  ssoSupport: false,
  competencyModule: false,
  accreditationModule: false,
  bulkImport: false,
  customCertificates: false,
}

const DEFAULT_LIMITS: PlanLimits = {
  maxStaff: { current: 0, max: 0 },
  maxTrainings: { current: 0, max: 0 },
  maxStorageGb: { current: 0, max: 0 },
}

/**
 * Organizasyonun abonelik plani, ozellikleri ve limitlerini client-side'da kontrol eder.
 * Veriyi `/api/admin/subscription/status` endpoint'inden ceker.
 */
export function useSubscription(): UseSubscriptionReturn {
  const { data, isLoading, error, refetch } = useFetch<SubscriptionStatusResponse>(
    '/api/admin/subscription/status'
  )

  const features = data?.features ?? DEFAULT_FEATURES
  const limits = data?.limits ?? DEFAULT_LIMITS

  const canUse = useCallback(
    (feature: FeatureName): boolean => {
      return features[feature] === true
    },
    [features]
  )

  const isAtLimit = useCallback(
    (limit: LimitName): boolean => {
      const l = limits[limit]
      if (!l || l.max === 0) return false
      return l.current >= l.max
    },
    [limits]
  )

  return useMemo(
    () => ({
      plan: data?.plan ?? null,
      features,
      limits,
      status: data?.status ?? 'unknown',
      isLoading,
      error,
      canUse,
      isAtLimit,
      refetch,
    }),
    [data, features, limits, isLoading, error, canUse, isAtLimit, refetch]
  )
}
