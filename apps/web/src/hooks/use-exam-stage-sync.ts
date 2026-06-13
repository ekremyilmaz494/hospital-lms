'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ExamRoute } from '@/lib/exam-state-machine'

/** Aynı sekme-dönüşü dalgasında üst üste istek atmamak için alt sınır. */
const SYNC_THROTTLE_MS = 10_000

/** ExamRoute → gerçek URL. videos/page.tsx'teki redirect eşlemesiyle birebir aynı. */
function routeToPath(route: ExamRoute, examId: string): string {
  if (route === 'my-trainings') return '/staff/my-trainings'
  if (route === 'my-training-detail') return `/staff/my-trainings/${examId}`
  return `/exam/${examId}/${route}`
}

/**
 * Sekme tekrar görünür/odaklı olduğunda sunucudan aşamayı doğrular ve
 * kullanıcı yanlış sayfadaysa sessizce doğru aşamaya yönlendirir.
 *
 * Çözdüğü senaryolar (Haziran 2026 kök neden denetimi, madde #7):
 *   - Cron attempt'i expire etti, sekme hâlâ video ekranında açık
 *   - Başka sekme aşamayı ilerletti (tab-lock devri sonrası)
 *   - Sınav süresi sekme gizliyken doldu (TIMEOUT)
 * Bunların hepsi eskiden ilk POST'un 400'üyle "Eğitim oturumu geçersiz"
 * dead-end modalına düşüyordu.
 *
 * @param examId   /exam/[id] route parametresi (assignmentId veya trainingId)
 * @param currentRoute kullanıcının şu an bulunduğu exam route'u
 * @param enabled  false iken senkron tamamen kapalı — review modunda ve bir
 *                 submit/transition uçuştayken kapatın (yarış önlenir)
 */
export function useExamStageSync(
  examId: string | null | undefined,
  currentRoute: ExamRoute,
  enabled: boolean = true,
) {
  const router = useRouter()
  const lastSyncAt = useRef(0)
  const inFlight = useRef(false)
  // enabled her render'da değişebilir (submit uçuşu) — listener'ları
  // re-mount etmeden canlı değeri ref üzerinden oku.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!examId) return
    let cancelled = false

    const sync = async () => {
      if (!enabledRef.current || inFlight.current) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastSyncAt.current < SYNC_THROTTLE_MS) return
      lastSyncAt.current = now
      inFlight.current = true
      try {
        const res = await fetch(`/api/exam/${examId}/state?from=${currentRoute}`, {
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { redirect?: ExamRoute | null }
        if (cancelled || !data?.redirect || !enabledRef.current) return
        router.replace(routeToPath(data.redirect, examId))
      } catch {
        // Best-effort: ağ hatasında sessiz kal — bir sonraki focus'ta tekrar
        // denenir; mevcut POST hata yolları (postWithRetry) zaten devrede.
      } finally {
        inFlight.current = false
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const onFocus = () => void sync()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [examId, currentRoute, router])
}
