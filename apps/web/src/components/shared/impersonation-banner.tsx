'use client'

import { useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LogOut, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SESSION_KEY = 'impersonation_context'

interface ImpersonationContext {
  impersonatedBy: string
  impersonatorName: string
}

/**
 * G3.4 — Inner banner that reads URL search params (requires Suspense boundary).
 * Derives impersonation context from URL params (on first load) or sessionStorage
 * (on subsequent navigations within the same impersonation session).
 * No setState in effects — context is derived synchronously.
 */
function ImpersonationBannerInner() {
  const searchParams = useSearchParams()

  const impersonatedByParam = searchParams.get('impersonated_by')
  const impersonatorNameParam = searchParams.get('impersonator_name')

  // Derive context from URL params (primary) or sessionStorage (secondary)
  const ctx = useMemo<ImpersonationContext | null>(() => {
    if (typeof window === 'undefined') return null

    if (impersonatedByParam && impersonatorNameParam) {
      return {
        impersonatedBy: impersonatedByParam,
        impersonatorName: decodeURIComponent(impersonatorNameParam),
      }
    }

    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) return JSON.parse(stored) as ImpersonationContext
    } catch { /* ignore */ }

    return null
  }, [impersonatedByParam, impersonatorNameParam])

  // Side effect: persist context to sessionStorage when it comes from URL params
  useEffect(() => {
    if (!ctx || !impersonatedByParam) return
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(ctx))
    } catch { /* ignore */ }
  }, [ctx, impersonatedByParam])

  const handleExit = async () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch { /* ignore */ }
    const supabase = createClient()
    await supabase.auth.signOut()
    window.close()
    // Fallback if window.close() is blocked
    window.location.href = '/auth/login'
  }

  if (!ctx) return null

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-5 py-2.5"
      style={{
        background: 'linear-gradient(90deg, var(--color-warning), #d97706)',
        color: 'white',
      }}
    >
      <div className="flex items-center gap-2.5">
        <UserCog className="h-4 w-4 shrink-0" />
        <p className="text-[13px] font-semibold">
          Şu anda <strong>{ctx.impersonatorName}</strong> adına oturum açık görüntülüyorsunuz
          <span className="ml-2 text-[11px] font-normal opacity-80">(Impersonation Session)</span>
        </p>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-bold transition-opacity duration-150 hover:opacity-80"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        <LogOut className="h-3.5 w-3.5" />
        Çık
      </button>
    </div>
  )
}

/**
 * G3.4 — Suspense wrapper required because useSearchParams() suspends during SSR.
 * Returns null during SSR/loading; shows the banner only when impersonation context exists.
 */
export function ImpersonationBanner() {
  return (
    <Suspense fallback={null}>
      <ImpersonationBannerInner />
    </Suspense>
  )
}
