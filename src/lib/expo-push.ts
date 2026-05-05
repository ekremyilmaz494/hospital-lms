import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Expo Push API client — Klinovax mobil uygulamasına bildirim gönderir.
 *
 * Mimari:
 * - Token'lar `expo_push_tokens` tablosunda — kullanıcı başına çok cihaz olabilir
 * - Expo'nun HTTP API'sine batch ile gönderilir (max 100 mesaj/istek)
 * - **Iki aşamalı async**: send response'taki tickets "kabul edildi" demek;
 *   gerçek delivery 15dk-30dk sonra `getReceipts` ile öğrenilir.
 * - **Initial cleanup**: send response'ta `DeviceNotRegistered` ise token anında silinir
 * - **Receipt cleanup**: cron `/api/cron/expo-receipts` daily poll'la token'ı siler
 *   (uninstall edilmiş cihaz; saatler-günler sonra ortaya çıkar)
 * - **Audit**: her ticket `expo_push_tickets` tablosuna kaydedilir (status='pending'),
 *   receipt cron'u status'u 'ok'/'error'/'expired'a güncellemekle yükümlü
 *
 * Web push (`lib/web-push.ts`) ile paralel çalışır, çakışma yok. Cron'lar
 * her ikisini de çağırarak hem PWA hem mobil tarafa fan-out yapar.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

export interface ExpoPushPayload {
  title: string
  body: string
  /** Bildirime dokunulduğunda mobile app'in açacağı in-app rota (örn. /trainings/[id]) */
  url?: string
  /** Ek data — mobile handler'da `notification.request.content.data` içinden okunur */
  data?: Record<string, unknown>
  /** iOS badge sayısı (toplam okunmamış) — opsiyonel */
  badge?: number
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound: 'default'
  priority: 'high'
  badge?: number
  channelId?: string // Android için
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

interface ExpoResponse {
  data: ExpoTicket[]
  errors?: { code: string; message: string }[]
}

/**
 * Belirli bir kullanıcının TÜM cihazlarına bildirim gönder. Birden fazla
 * cihazı varsa hepsine paralel ulaşır.
 */
export async function sendExpoPushToUser(
  userId: string,
  payload: ExpoPushPayload,
): Promise<void> {
  const tokens = await prisma.expoPushToken.findMany({
    where: { userId },
    select: { token: true, userId: true },
  })
  if (tokens.length === 0) return
  await sendToExpoTokens(tokens, payload)
}

/**
 * Birden fazla kullanıcıya toplu bildirim — admin broadcast / cron senaryoları.
 * 100'lük batch'ler hâlinde Expo API'ye gönderir.
 */
export async function sendExpoPushToMany(
  userIds: string[],
  payload: ExpoPushPayload,
): Promise<void> {
  if (userIds.length === 0) return
  const tokens = await prisma.expoPushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true, userId: true },
  })
  if (tokens.length === 0) return
  await sendToExpoTokens(tokens, payload)
}

interface TokenRecord {
  token: string
  userId: string
}

/** Düşük seviyeli sender — token listesini batch'leyip Expo'ya gönderir.
 *
 * Audit: her ticket için `expo_push_tickets` kaydı yaratılır; receipt cron'u
 * status'u günceller (pending → ok/error/expired). Initial response'taki
 * DeviceNotRegistered hem ticket'ta error olarak loglanır hem de token DB'den
 * anında silinir (receipt'i beklemeye gerek yok, kesin geçersiz). */
async function sendToExpoTokens(
  tokenRecords: TokenRecord[],
  payload: ExpoPushPayload,
): Promise<void> {
  const messages: ExpoMessage[] = tokenRecords.map(t => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? (payload.url ? { url: payload.url } : undefined),
    sound: 'default',
    priority: 'high',
    badge: payload.badge,
    channelId: 'default',
  }))

  const expiredTokens: string[] = []
  // Birikmiş ticket kayıtları — batch sonrası tek `createMany` round-trip'i
  type TicketRow = {
    ticketId: string
    userId: string
    token: string
    status: 'pending' | 'error'
    errorCode: string | null
    errorDetails: string | null
  }
  const ticketRows: TicketRow[] = []

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    const batchRecords = tokenRecords.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: {
          'Accept':           'application/json',
          'Accept-Encoding':  'gzip, deflate',
          'Content-Type':     'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (!res.ok) {
        logger.warn('expo-push', `Expo API HTTP ${res.status}`, await res.text())
        continue
      }
      const data = (await res.json()) as ExpoResponse
      // Expo response'undaki tickets array'i request'teki batch sırasıyla aynı —
      // doc garantisi (https://docs.expo.dev/push-notifications/sending-notifications/)
      data.data?.forEach((ticket, idx) => {
        const record = batchRecords[idx]
        if (!record) return
        if (ticket.status === 'ok' && ticket.id) {
          ticketRows.push({
            ticketId: ticket.id,
            userId: record.userId,
            token: record.token,
            status: 'pending',
            errorCode: null,
            errorDetails: null,
          })
        } else if (ticket.status === 'error') {
          // Initial error: token format/auth sorunu, receipt beklemeye gerek yok
          if (ticket.details?.error === 'DeviceNotRegistered') {
            expiredTokens.push(record.token)
          }
          // ticket.id 'error' durumunda da gelebilir (Expo bazen verir, bazen vermez).
          // Yoksa audit'e yine de unique synthetic id ile yazmak yerine sadece logluyoruz —
          // receipt cron'u zaten bu kaydı görmeyecek (ticket id yok).
          if (ticket.id) {
            ticketRows.push({
              ticketId: ticket.id,
              userId: record.userId,
              token: record.token,
              status: 'error',
              errorCode: ticket.details?.error ?? 'ExpoError',
              errorDetails: ticket.message ?? null,
            })
          }
        }
      })
    } catch (err) {
      logger.error('expo-push', 'Batch gönderiminde hata', err)
    }
  }

  // Audit: ticket kayıtlarını tek round-trip ile yaz — yüzlerce push'ta DB yükü düşsün
  if (ticketRows.length > 0) {
    try {
      await prisma.expoPushTicket.createMany({
        data: ticketRows.map(r => ({
          ticketId: r.ticketId,
          userId: r.userId,
          token: r.token,
          status: r.status,
          errorCode: r.errorCode,
          errorDetails: r.errorDetails,
          // sentAt default(now()), receiptAt null — cron dolduracak
        })),
        skipDuplicates: true, // Aynı ticket id iki kez gelirse (retry vs.) yutulsun
      })
    } catch (err) {
      // Audit DB hatası push akışını durdurmasın — push zaten gitti
      logger.error('expo-push', 'Ticket audit DB yazma hatası', err)
    }
  }

  // Geçersiz token'ları DB'den sil — uninstall edilmiş cihazları temizle
  if (expiredTokens.length > 0) {
    await prisma.expoPushToken.deleteMany({
      where: { token: { in: expiredTokens } },
    })
    logger.info('expo-push', `${expiredTokens.length} expired token temizlendi (initial)`)
  }
}
