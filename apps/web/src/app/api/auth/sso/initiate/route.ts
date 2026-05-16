import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, getAppUrl } from '@/lib/api-helpers'
import { createSsoState } from '@/lib/sso'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.email) return errorResponse('E-posta adresi gereklidir', 400)

  const email = (body.email as string).trim().toLowerCase()
  const domain = email.split('@')[1]
  if (!domain) return errorResponse('Geçersiz e-posta adresi', 400)

  // Find organization by SSO email domain
  const org = await prisma.organization.findFirst({
    where: {
      ssoEnabled: true,
      ssoEmailDomain: domain,
      isActive: true,
      isSuspended: false,
    },
    select: {
      id: true,
      name: true,
      ssoProvider: true,
      samlEntryPoint: true,
      samlIssuer: true,
      oidcDiscoveryUrl: true,
      oidcClientId: true,
    },
  })

  if (!org) {
    return NextResponse.json({ ssoAvailable: false })
  }

  const appUrl = getAppUrl()
  const callbackUrl = `${appUrl}/api/auth/sso/callback`

  if (org.ssoProvider === 'saml' && org.samlEntryPoint) {
    // Nonce tabanli state olustur (CSRF korumasi)
    const stateNonce = await createSsoState(org.id, email)

    // SAML: redirect to IdP with RelayState (nonce, plain JSON degil)
    const samlUrl = new URL(org.samlEntryPoint)
    samlUrl.searchParams.set('RelayState', stateNonce)
    logger.info('sso:initiate', 'SAML redirect', { orgId: org.id, domain })

    return NextResponse.json({
      ssoAvailable: true,
      provider: 'saml',
      redirectUrl: samlUrl.toString(),
      orgName: org.name,
    })
  }

  if (org.ssoProvider === 'oidc' && org.oidcDiscoveryUrl && org.oidcClientId) {
    // OIDC: build authorize URL from discovery endpoint
    try {
      // Nonce tabanli state olustur (CSRF korumasi)
      const stateNonce = await createSsoState(org.id, email)

      const discovery = await fetch(org.oidcDiscoveryUrl).then(r => r.json())
      const authorizeUrl = new URL(discovery.authorization_endpoint)
      authorizeUrl.searchParams.set('client_id', org.oidcClientId)
      authorizeUrl.searchParams.set('redirect_uri', callbackUrl)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('scope', 'openid email profile')
      authorizeUrl.searchParams.set('state', stateNonce)

      logger.info('sso:initiate', 'OIDC redirect', { orgId: org.id, domain })

      return NextResponse.json({
        ssoAvailable: true,
        provider: 'oidc',
        redirectUrl: authorizeUrl.toString(),
        orgName: org.name,
      })
    } catch {
      return errorResponse('SSO yapılandırması hatalı', 500)
    }
  }

  // Supabase OAuth providers (google, azure, etc.)
  if (org.ssoProvider && ['google', 'azure', 'github'].includes(org.ssoProvider)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const redirectUrl = `${supabaseUrl}/auth/v1/authorize?provider=${org.ssoProvider}&redirect_to=${encodeURIComponent(`${appUrl}/auth/callback`)}`

    return NextResponse.json({
      ssoAvailable: true,
      provider: org.ssoProvider,
      redirectUrl,
      orgName: org.name,
    })
  }

  return NextResponse.json({ ssoAvailable: false })
}
