import { NextResponse } from 'next/server'

/**
 * Eski per-tenant SMTP konfigürasyonu, merkezi SES'e taşındı.
 * Geriye uyumluluk için 308 ile yeni `/api/admin/settings/email` adresine yönlendirir.
 * Eski SMTP UI tab'ı kaldırıldı; sadece dış entegrasyonlar buraya isabet edebilir.
 */
function gone() {
  return NextResponse.json(
    {
      error: 'Bu uç nokta taşındı.',
      message: 'SMTP konfigürasyonu artık merkezi (AWS SES). Tenant ayarları için /api/admin/settings/email kullanın.',
      newPath: '/api/admin/settings/email',
    },
    { status: 308, headers: { Location: '/api/admin/settings/email', 'Cache-Control': 'no-store' } },
  )
}

export const GET = gone
export const PUT = gone
export const POST = gone
export const PATCH = gone
export const DELETE = gone
