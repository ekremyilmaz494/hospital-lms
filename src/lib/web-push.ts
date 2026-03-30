import webPush from 'web-push'

// VAPID yapılandırması — sunucu başladığında bir kez set edilir
if (process.env.NEXT_PUBLIC_VAPID_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.SMTP_FROM ?? 'admin@hastanelms.com'}`,
    process.env.NEXT_PUBLIC_VAPID_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export interface PushPayload {
  title: string
  body: string
  /** Bildirime tıklandığında açılacak URL */
  url?: string
}

export interface PushSubscriptionData {
  endpoint: string
  p256dh:   string
  auth:     string
}

/**
 * Tek bir aboneliğe Web Push bildirimi gönder.
 * Döndürdüğü hata 410 ise abonelik sona ermiş demektir — DB'den silinmeli.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; expired: boolean; error: string }> {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth:   subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 86400 }, // 24 saat geçerli
    )
    return { ok: true }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    return {
      ok:      false,
      expired: statusCode === 410 || statusCode === 404,
      error:   (err as Error).message ?? 'Push gönderilemedi',
    }
  }
}

/**
 * Birden fazla aboneliğe toplu bildirim gönder.
 * Süresi dolmuş aboneliklerin endpoint'lerini döndürür (DB'den silinmesi için).
 */
export async function sendPushToMany(
  subscriptions: PushSubscriptionData[],
  payload: PushPayload,
): Promise<{ expiredEndpoints: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload)),
  )

  const expiredEndpoints: string[] = []
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled' && !result.value.ok && result.value.expired) {
      expiredEndpoints.push(subscriptions[idx].endpoint)
    }
  })

  return { expiredEndpoints }
}
