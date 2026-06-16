import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withApiHandler } from '@/lib/api-handler'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

export const GET = withApiHandler(async ({ organizationId }) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
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
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { roles: ['admin', 'super_admin'], strict: true, requireOrganization: true })

export const PUT = withApiHandler(async ({ request, organizationId, audit }) => {
  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const {
    ssoEnabled, ssoProvider, ssoEmailDomain,
    samlEntryPoint, samlIssuer, samlCert,
    oidcDiscoveryUrl, oidcClientId, oidcClientSecret,
    ssoAutoProvision, ssoDefaultRole,
  } = body

  // ssoDefaultRole allow-list — 'super_admin' (veya geçersiz değer) YASAK.
  // Aksi halde org-scope'lu admin, ssoDefaultRole='super_admin' yazıp SSO ile giren
  // kullanıcıyı platform-geneli super_admin'e yükseltebilir (privilege escalation):
  // sso/callback bu değeri auto-provision rolü olarak kullanıyor. UserRole enum'u
  // super_admin'i içerdiği için Prisma yazımı engellemez — guard burada zorunlu.
  if (ssoDefaultRole !== undefined && ssoDefaultRole !== 'admin' && ssoDefaultRole !== 'staff') {
    return errorResponse('Geçersiz SSO varsayılan rolü — yalnızca "admin" veya "staff" olabilir', 400)
  }

  // OIDC client secret at-rest encryption — boş string gönderildiyse dokunma
  // (UI'da "değiştirme" için placeholder geçilmiş olabilir).
  let oidcClientSecretEncrypted: string | undefined
  if (typeof oidcClientSecret === 'string' && oidcClientSecret.length > 0) {
    try {
      oidcClientSecretEncrypted = encrypt(oidcClientSecret)
    } catch (err) {
      logger.error('sso:config', 'OIDC client secret şifrelenemedi', err)
      return errorResponse('OIDC secret güvenli şekilde saklanamadı. ENCRYPTION_KEY yapılandırmasını kontrol edin.', 500)
    }
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(ssoEnabled !== undefined && { ssoEnabled }),
      ...(ssoProvider !== undefined && { ssoProvider }),
      ...(ssoEmailDomain !== undefined && { ssoEmailDomain }),
      ...(samlEntryPoint !== undefined && { samlEntryPoint }),
      ...(samlIssuer !== undefined && { samlIssuer }),
      ...(samlCert !== undefined && { samlCert }),
      ...(oidcDiscoveryUrl !== undefined && { oidcDiscoveryUrl }),
      ...(oidcClientId !== undefined && { oidcClientId }),
      ...(oidcClientSecretEncrypted !== undefined && { oidcClientSecret: oidcClientSecretEncrypted }),
      ...(ssoAutoProvision !== undefined && { ssoAutoProvision }),
      ...(ssoDefaultRole !== undefined && { ssoDefaultRole }),
    },
  })

  await audit({
    action: 'sso.update',
    entityType: 'organization',
    entityId: organizationId,
  })

  return jsonResponse({ success: true })
}, { roles: ['admin', 'super_admin'], strict: true, requireOrganization: true })
