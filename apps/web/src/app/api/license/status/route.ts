import { NextResponse } from 'next/server'
import { getLicenseState } from '@/lib/license/cache'
import { isOnPrem } from '@/lib/deployment'

/**
 * GET /api/license/status — açık uç (kilitliyken bile erişilir; /license ekranı
 * ve banner bunu okur). Sır YOK: yalnız durum, kalan gün, limitler, müşteri adı.
 * Bulut modunda lisans kavramı yoktur → mode: 'cloud'.
 */
export async function GET() {
  if (!isOnPrem()) {
    return NextResponse.json(
      { mode: 'cloud', state: 'VALID' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const s = await getLicenseState()
  return NextResponse.json(
    {
      mode: 'onprem',
      state: s.state,
      reasons: s.reasons,
      daysToExpiry: s.daysToExpiry,
      offlineDaysLeft: s.offlineDaysLeft,
      limits: s.limits,
      customerName: s.customerName,
      licenseId: s.licenseId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
