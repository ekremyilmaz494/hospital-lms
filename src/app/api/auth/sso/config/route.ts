import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organizasyon bulunamadi', 403)

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      ssoEnabled: true,
      ssoProvider: true,
      ssoEmailDomain: true,
      samlEntryPoint: true,
      samlIssuer: true,
      samlCert: true,
      oidcDiscoveryUrl: true,
      oidcClientId: true,
      ssoAutoProvision: true,
      ssoDefaultRole: true,
    },
  })

  return jsonResponse({
    ssoEnabled: org?.ssoEnabled ?? false,
    ssoProvider: org?.ssoProvider ?? '',
    ssoEmailDomain: org?.ssoEmailDomain ?? '',
    samlEntryPoint: org?.samlEntryPoint ?? '',
    samlIssuer: org?.samlIssuer ?? '',
    hasSamlCert: !!org?.samlCert,
    oidcDiscoveryUrl: org?.oidcDiscoveryUrl ?? '',
    oidcClientId: org?.oidcClientId ?? '',
    ssoAutoProvision: org?.ssoAutoProvision ?? true,
    ssoDefaultRole: org?.ssoDefaultRole ?? 'staff',
  })
}

export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organizasyon bulunamadi', 403)

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Gecersiz istek verisi')

  const {
    ssoEnabled, ssoProvider, ssoEmailDomain,
    samlEntryPoint, samlIssuer, samlCert,
    oidcDiscoveryUrl, oidcClientId, oidcClientSecret,
    ssoAutoProvision, ssoDefaultRole,
  } = body

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(ssoEnabled !== undefined && { ssoEnabled }),
      ...(ssoProvider !== undefined && { ssoProvider }),
      ...(ssoEmailDomain !== undefined && { ssoEmailDomain }),
      ...(samlEntryPoint !== undefined && { samlEntryPoint }),
      ...(samlIssuer !== undefined && { samlIssuer }),
      ...(samlCert !== undefined && { samlCert }),
      ...(oidcDiscoveryUrl !== undefined && { oidcDiscoveryUrl }),
      ...(oidcClientId !== undefined && { oidcClientId }),
      ...(oidcClientSecret !== undefined && { oidcClientSecret }),
      ...(ssoAutoProvision !== undefined && { ssoAutoProvision }),
      ...(ssoDefaultRole !== undefined && { ssoDefaultRole }),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'sso.update',
    entityType: 'organization',
    entityId: orgId,
    request,
  })

  return jsonResponse({ success: true })
}
