import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
} from '@/lib/api-helpers'

/** GET /api/admin/content-library — kurumun erişebildiği aktif içerikler + isInstalled flag */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = category

  // İçerik listesi ve kurumun kurduğu içerik ID'lerini paralel çek
  const [items, installs] = await Promise.all([
    prisma.contentLibrary.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    }),
    prisma.organizationContentLibrary.findMany({
      where: { organizationId: orgId },
      select: { contentLibraryId: true },
    }),
  ])

  const installedSet = new Set(installs.map(i => i.contentLibraryId))

  return jsonResponse({
    items: items.map(item => ({
      ...item,
      targetRoles: item.targetRoles as string[],
      isInstalled: installedSet.has(item.id),
    })),
  })
}
