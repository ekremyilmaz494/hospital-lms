import { NextResponse } from 'next/server'

/**
 * Eski SMTP canlı test endpoint'i, merkezi SES test'e taşındı.
 * 308 redirect → /api/admin/settings/email/test
 */
function gone() {
  return NextResponse.json(
    {
      error: 'Bu uç nokta taşındı.',
      message: 'SMTP testi artık merkezi (AWS SES). /api/admin/settings/email/test kullanın.',
      newPath: '/api/admin/settings/email/test',
    },
    { status: 308, headers: { Location: '/api/admin/settings/email/test', 'Cache-Control': 'no-store' } },
  )
}

export const POST = gone
export const GET = gone
