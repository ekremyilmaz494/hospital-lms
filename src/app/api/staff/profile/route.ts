import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const profile = await prisma.user.findUnique({
    where: { id: dbUser!.id },
    include: {
      organization: { select: { name: true, code: true } },
      departmentRel: { select: { name: true } },
      _count: { select: { assignments: true, examAttempts: true, certificates: true } },
    },
  })

  if (!profile) return errorResponse('Kullanıcı bulunamadı', 404)

  return jsonResponse({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone ?? '',
    hospital: profile.organization?.name ?? '',
    department: profile.departmentRel?.name ?? profile.department ?? '',
    title: profile.title ?? '',
    tcKimlik: profile.tcNo ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    stats: {
      assignments: profile._count.assignments,
      exams: profile._count.examAttempts,
      certificates: profile._count.certificates,
    },
    createdAt: profile.createdAt,
  })
}

interface PatchBody {
  firstName?: string
  lastName?: string
  phone?: string
  avatarUrl?: string
  currentPassword?: string
  newPassword?: string
}

export async function PATCH(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const allowed = await checkRateLimit(`profile-update:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody<PatchBody>(request)
  if (!body) return errorResponse('Geçersiz istek')

  // Update profile fields
  const updateData: Record<string, string> = {}
  if (body.firstName !== undefined) updateData.firstName = body.firstName.trim()
  if (body.lastName !== undefined) updateData.lastName = body.lastName.trim()
  if (body.phone !== undefined) updateData.phone = body.phone.trim()
  if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: dbUser!.id },
      data: updateData,
    })

    // Sync name to Supabase user_metadata
    if (body.firstName || body.lastName) {
      const supabase = await createClient()
      await supabase.auth.updateUser({
        data: {
          ...(body.firstName && { first_name: body.firstName.trim() }),
          ...(body.lastName && { last_name: body.lastName.trim() }),
          ...(body.phone && { phone: body.phone.trim() }),
        },
      })
    }

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'profile.updated',
      entityType: 'user',
      entityId: dbUser!.id,
      newData: updateData,
      request,
    })
  }

  // Password change
  if (body.newPassword) {
    if (!body.currentPassword) {
      return errorResponse('Mevcut şifre gerekli')
    }
    if (body.newPassword.length < 8 || !/[A-Z]/.test(body.newPassword) || !/\d/.test(body.newPassword)) {
      return errorResponse('Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir')
    }

    const supabase = await createClient()

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: dbUser!.email,
      password: body.currentPassword,
    })
    if (signInError) {
      return errorResponse('Mevcut şifre hatalı')
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: body.newPassword,
    })
    if (updateError) {
      return errorResponse('Şifre güncellenemedi: ' + updateError.message)
    }

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'password.changed',
      entityType: 'user',
      entityId: dbUser!.id,
      request,
    })
  }

  return jsonResponse({ success: true })
}
