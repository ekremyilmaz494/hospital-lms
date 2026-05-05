import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Expo Push Receipt poll cron — günde bir kez (07:15 Istanbul) çalışır.
 *
 * Pipeline:
 *   1. `expo_push_tickets` tablosundan `status='pending' AND sentAt > now-25h`
 *      kayıtları çek (Expo 7 gün saklıyor; daha eski olabilen pending'leri ayrıca
 *      `expired` olarak işaretliyoruz).
 *   2. Ticket id'leri 1000'lik batch'lerle Expo `getReceipts` endpoint'ine sorgu at.
 *   3. Receipt response'una göre:
 *        ok                              → status='ok', receiptAt=now
 *        error + DeviceNotRegistered     → token cleanup + status='error'
 *        error + diğer                   → status='error' + errorCode/Details
 *        response yok (henüz hazır değil) → bırak, yarın tekrar denenir
 *   4. 25h+ pending kalanları toplu `expired` işaretle.
 *
 * Auth: Bearer ${CRON_SECRET} (mevcut cron pattern).
 */

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
const RECEIPTS_BATCH_SIZE = 1000
const PENDING_WINDOW_MS = 25 * 60 * 60 * 1000 // 25 saat

interface ReceiptOk {
  status: 'ok'
}
interface ReceiptError {
  status: 'error'
  message?: string
  details?: { error?: string }
}
type Receipt = ReceiptOk | ReceiptError

interface ReceiptsResponse {
  data?: Record<string, Receipt>
  errors?: { code: string; message: string }[]
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const now = Date.now()
  const windowStart = new Date(now - PENDING_WINDOW_MS)

  const pending = await prisma.expoPushTicket.findMany({
    where: {
      status: 'pending',
      sentAt: { gte: windowStart },
    },
    select: { id: true, ticketId: true, token: true },
    orderBy: { sentAt: 'asc' },
  })

  let okCount = 0
  let deviceNotRegistered = 0
  let otherErrors = 0
  const tokensToDelete = new Set<string>()

  for (let i = 0; i < pending.length; i += RECEIPTS_BATCH_SIZE) {
    const batch = pending.slice(i, i + RECEIPTS_BATCH_SIZE)
    let response: ReceiptsResponse
    try {
      const res = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: batch.map(t => t.ticketId) }),
      })
      if (!res.ok) {
        logger.warn('expo-receipts', `Expo getReceipts HTTP ${res.status}`, await res.text())
        continue
      }
      response = (await res.json()) as ReceiptsResponse
    } catch (err) {
      logger.error('expo-receipts', 'getReceipts fetch hatası', err)
      continue
    }

    const receipts = response.data ?? {}

    for (const ticket of batch) {
      const receipt = receipts[ticket.ticketId]
      if (!receipt) continue // Henüz hazır değil; bir sonraki cron'da denenir

      if (receipt.status === 'ok') {
        await prisma.expoPushTicket.update({
          where: { id: ticket.id },
          data: { status: 'ok', receiptAt: new Date() },
        })
        okCount++
      } else {
        const errorCode = receipt.details?.error ?? 'ExpoError'
        await prisma.expoPushTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'error',
            receiptAt: new Date(),
            errorCode,
            errorDetails: receipt.message ?? null,
          },
        })
        if (errorCode === 'DeviceNotRegistered') {
          tokensToDelete.add(ticket.token)
          deviceNotRegistered++
        } else {
          otherErrors++
          // Kritik hatalar (InvalidCredentials APN/FCM cred bozuk) ops dikkati ister
          if (errorCode === 'InvalidCredentials') {
            logger.error('expo-receipts', `KRITIK: InvalidCredentials ticket ${ticket.ticketId}`, receipt.message)
          }
        }
      }
    }
  }

  // 25h+ pending → expired (Expo 7 gün saklıyor ama biz erken cleanup yapıyoruz)
  const expired = await prisma.expoPushTicket.updateMany({
    where: {
      status: 'pending',
      sentAt: { lt: windowStart },
    },
    data: { status: 'expired', receiptAt: new Date() },
  })

  // DeviceNotRegistered token cleanup — set ile dedup, tek deleteMany
  let cleanedTokens = 0
  if (tokensToDelete.size > 0) {
    const result = await prisma.expoPushToken.deleteMany({
      where: { token: { in: Array.from(tokensToDelete) } },
    })
    cleanedTokens = result.count
    logger.info('expo-receipts', `${cleanedTokens} expired token temizlendi (receipt)`)
  }

  return NextResponse.json(
    {
      checked: pending.length,
      ok: okCount,
      deviceNotRegistered,
      otherErrors,
      expired: expired.count,
      cleanedTokens,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
