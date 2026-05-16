import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

const forgotPasswordSchema = z.object({
  email: z.email('Geçerli bir e-posta adresi girin'),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'

  // IP bazlı rate limit: 5 istek / 15 dakika
  const ipAllowed = await checkRateLimit(`forgot-pw:ip:${ip}`, 5, 900)
  if (!ipAllowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Geçersiz istek verisi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { email } = parsed.data

  // Email bazlı rate limit: 3 istek / 1 saat
  const emailAllowed = await checkRateLimit(`forgot-pw:email:${email.toLowerCase()}`, 3, 3600)
  if (!emailAllowed) {
    // Güvenlik: email var/yok bilgisi sızdırma — aynı başarı mesajı dön
    return new Response(JSON.stringify({ success: true, message: 'E-posta adresinize şifre sıfırlama bağlantısı gönderildi.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = await createServiceClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    })

    logger.info('Auth', `Şifre sıfırlama talebi: ${email}`)
  } catch (err) {
    logger.error('Auth', 'Şifre sıfırlama hatası', { error: err })
  }

  // Güvenlik: Email var/yok bilgisi sızdırmamak için her zaman aynı yanıt
  return new Response(JSON.stringify({ success: true, message: 'E-posta adresinize şifre sıfırlama bağlantısı gönderildi.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
