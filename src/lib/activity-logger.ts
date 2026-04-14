import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/** Sistemde takip edilen aksiyon tipleri */
export type ActivityAction =
  // Auth
  | 'login'
  | 'logout'
  // Eğitim
  | 'course_view'
  | 'course_start'
  | 'course_complete'
  // Sınav
  | 'exam_start'
  | 'exam_submit'
  | 'exam_pass'
  | 'exam_fail'
  // Sertifika
  | 'certificate_view'
  | 'certificate_download'
  // Profil
  | 'profile_update'
  | 'password_change'

/** Kaynağın hangi tabloya ait olduğu */
export type ResourceType =
  | 'course'
  | 'exam'
  | 'exam_attempt'
  | 'certificate'
  | 'user'

export interface LogActivityParams {
  userId: string
  organizationId: string
  action: ActivityAction
  resourceType?: ResourceType
  resourceId?: string
  resourceTitle?: string
  /** Aksiyona özel ek veri: skor, süre, vs. */
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Kullanıcı aktivitesini `activity_logs` tablosuna yazar.
 *
 * Fire-and-forget kullanımı için `void` ile çağır:
 * ```ts
 * void logActivity({ userId, organizationId, action: 'course_view', ... })
 * ```
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  // super_admin organizasyona bağlı değil — activity_logs.organization_id NOT NULL
  if (!params.organizationId) return

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('activity_logs').insert({
      user_id: params.userId,
      organization_id: params.organizationId,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      resource_title: params.resourceTitle ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
    })

    if (error) {
      logger.warn('ActivityLogger', 'Log yazılamadı', { error: error.message })
    }
  } catch (err) {
    logger.error('ActivityLogger', 'Beklenmeyen hata', err)
  }
}

/**
 * IP adresini Next.js request headers'ından çıkarır.
 * `x-forwarded-for` → Vercel/proxy arkasında gerçek IP.
 */
export function getIpFromHeaders(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    undefined
  )
}
