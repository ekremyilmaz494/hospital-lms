import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/redis'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`auth-health:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Cok fazla istek. Lutfen bekleyin.', 429)

  const supabase = await createServiceClient()

  // Supabase auth kullanıcılarını çek (max 1000)
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) return errorResponse('Auth kullanicilari alinamadi', 500)

  const authUsers = authData?.users ?? []
  const authIds = new Set(authUsers.map(u => u.id))

  // DB kullanıcılarını çek
  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true, isActive: true },
  })
  const dbIds = new Set(dbUsers.map(u => u.id))

  // Orphans: Supabase'de var, DB'de yok
  const orphans = authUsers
    .filter(u => !dbIds.has(u.id))
    .map(u => ({ id: u.id, email: u.email ?? '', createdAt: u.created_at }))

  // Ghosts: DB'de var, Supabase'de yok
  const ghosts = dbUsers
    .filter(u => !authIds.has(u.id))
    .map(u => ({ id: u.id, email: u.email, role: u.role }))

  // Unconfirmed: email_confirmed_at null
  const unconfirmed = authUsers
    .filter(u => !u.email_confirmed_at)
    .map(u => ({ id: u.id, email: u.email ?? '', createdAt: u.created_at }))

  return jsonResponse({
    summary: {
      totalAuth: authUsers.length,
      totalDb: dbUsers.length,
      orphans: orphans.length,
      ghosts: ghosts.length,
      unconfirmed: unconfirmed.length,
    },
    orphans,
    ghosts,
    unconfirmed,
  }, 200, { 'Cache-Control': 'private, max-age=10' })
}
