import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v4'
import { passwordChangedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity-logger'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre zorunludur'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalıdır').max(128),
  confirmPassword: z.string().min(1, 'Şifre tekrarı zorunludur'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
})

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { currentPassword, newPassword } = parsed.data

  // Mevcut şifreyi doğrulamak için signInWithPassword kullan
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: dbUser!.email,
    password: currentPassword,
  })

  if (signInError) {
    return errorResponse('Mevcut şifre hatalı', 400)
  }

  // Yeni şifreyi güncelle
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return errorResponse('Şifre güncellenemedi. Lütfen tekrar deneyin.', 500)
  }

  // mustChangePassword bayrağını kaldır
  if (dbUser!.mustChangePassword) {
    await prisma.user.update({
      where: { id: dbUser!.id },
      data: { mustChangePassword: false },
    })
  }

  // Şifre değişikliği bildirimi (fire-and-forget)
  passwordChangedEmail(dbUser!.email)
    .catch(err => logger.warn('PwdEmail', 'Sifre degistirme emaili gonderilemedi', (err as Error).message))

  void logActivity({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId ?? '',
    action: 'password_change',
  })

  return jsonResponse({ message: 'Şifreniz başarıyla güncellendi' })
}
