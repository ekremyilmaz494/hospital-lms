import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import {
  verifySsoState,
  verifySamlSignature,
  extractSamlIdentity,
  verifyOidcToken,
} from '@/lib/sso'

/**
 * POST /api/auth/sso/callback
 * SAML ACS (Assertion Consumer Service) endpoint — IdP posts SAML response here.
 * Imza dogrulamasi + nonce dogrulamasi yapilir.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  const samlResponse = formData?.get('SAMLResponse') as string | null
  const relayState = formData?.get('RelayState') as string | null

  if (!samlResponse || !relayState) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }

  // Nonce tabanli state dogrulama (CSRF korumasi)
  const state = await verifySsoState(relayState)
  if (!state) {
    logger.warn('sso:callback', 'Gecersiz veya suresi dolmus SSO state (SAML)', { relayState: relayState.slice(0, 8) + '...' })
    return NextResponse.redirect(new URL('/auth/login?error=sso_state_invalid', request.url))
  }

  // Get org config for certificate validation
  const org = await prisma.organization.findFirst({
    where: { id: state.orgId, ssoEnabled: true, isActive: true },
    select: {
      id: true,
      samlCert: true,
      ssoAutoProvision: true,
      ssoDefaultRole: true,
    },
  })

  if (!org) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_org_not_found', request.url))
  }

  // Decode SAML response (Base64)
  let samlXml: string
  try {
    samlXml = Buffer.from(samlResponse, 'base64').toString('utf-8')
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=sso_invalid_response', request.url))
  }

  // SAML imza dogrulamasi (KRITIK guvenlik kontrolu)
  if (!org.samlCert) {
    logger.error('sso:callback', 'SAML sertifikasi yapilandirilmamis', { orgId: org.id })
    return NextResponse.redirect(new URL('/auth/login?error=sso_config_error', request.url))
  }

  const signatureValid = verifySamlSignature(samlXml, org.samlCert)
  if (!signatureValid) {
    logger.warn('sso:callback', 'SAML imza dogrulanamadi — olasi sahte response', { orgId: org.id })
    return NextResponse.redirect(new URL('/auth/login?error=sso_signature_invalid', request.url))
  }

  // Imza dogrulandi — kimlik bilgilerini extract et
  const identity = extractSamlIdentity(samlXml)
  const email = identity.email || state.email
  const firstName = identity.firstName || email.split('@')[0]
  const lastName = identity.lastName || ''

  if (!email) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_no_email', request.url))
  }

  // Provision or login user
  return provisionAndLogin({ email, firstName, lastName, org, request })
}

/**
 * GET /api/auth/sso/callback
 * OIDC callback — exchange code for tokens, verify JWT signature.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }

  // Nonce tabanli state dogrulama (CSRF korumasi)
  const state = await verifySsoState(stateParam)
  if (!state) {
    logger.warn('sso:callback', 'Gecersiz veya suresi dolmus SSO state (OIDC)', { stateParam: stateParam.slice(0, 8) + '...' })
    return NextResponse.redirect(new URL('/auth/login?error=sso_state_invalid', request.url))
  }

  const org = await prisma.organization.findFirst({
    where: { id: state.orgId, ssoEnabled: true, isActive: true },
    select: {
      id: true,
      oidcDiscoveryUrl: true,
      oidcClientId: true,
      oidcClientSecret: true,
      ssoAutoProvision: true,
      ssoDefaultRole: true,
    },
  })

  if (!org || !org.oidcDiscoveryUrl || !org.oidcClientId || !org.oidcClientSecret) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_config_error', request.url))
  }

  // Exchange code for tokens
  try {
    const discoveryRes = await fetch(org.oidcDiscoveryUrl)
    if (!discoveryRes.ok) {
      return NextResponse.redirect(new URL('/auth/login?error=sso_discovery_failed', request.url))
    }
    const discovery = await discoveryRes.json()
    const appUrl = getAppUrl()

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/sso/callback`,
        client_id: org.oidcClientId,
        client_secret: org.oidcClientSecret,
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.id_token) {
      return NextResponse.redirect(new URL('/auth/login?error=sso_token_failed', request.url))
    }

    // JWT imza dogrulamasi (JWKS ile)
    const verification = await verifyOidcToken(
      tokens.id_token,
      org.oidcDiscoveryUrl,
      org.oidcClientId,
    )

    if (!verification.valid || !verification.payload) {
      logger.warn('sso:callback', 'OIDC token dogrulama basarisiz', {
        orgId: org.id,
        error: verification.error,
      })
      return NextResponse.redirect(new URL('/auth/login?error=sso_token_invalid', request.url))
    }

    const payload = verification.payload
    const email = (payload.email as string) || state.email
    const firstName = (payload.given_name as string) || (payload.name as string)?.split(' ')[0] || ''
    const lastName = (payload.family_name as string) || (payload.name as string)?.split(' ').slice(1).join(' ') || ''

    // Provision or login user
    return provisionAndLogin({ email, firstName, lastName, org, request })
  } catch (err) {
    logger.error('sso:callback', 'OIDC callback hatasi', err)
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }
}

/**
 * Ortak SSO provision + login akisi.
 * Kullanici yoksa auto-provision yapar (ayar aktifse), magic link ile session olusturur.
 */
async function provisionAndLogin({
  email,
  firstName,
  lastName,
  org,
  request,
}: {
  email: string
  firstName: string
  lastName: string
  org: {
    id: string
    ssoAutoProvision: boolean
    ssoDefaultRole: string
  }
  request: NextRequest
}) {
  const supabase = await createServiceClient()

  // Check if user exists
  let dbUser = await prisma.user.findUnique({ where: { email } })

  if (!dbUser && !org.ssoAutoProvision) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_user_not_provisioned', request.url))
  }

  if (!dbUser) {
    // Auto-provision: create Supabase auth user + DB user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        role: org.ssoDefaultRole,
        organization_id: org.id,
        first_name: firstName,
        last_name: lastName,
        sso_provider: 'sso',
      },
    })

    if (authError) {
      logger.error('sso:callback', 'Kullanici olusturulamadi', authError.message)
      return NextResponse.redirect(new URL('/auth/login?error=sso_provision_failed', request.url))
    }

    dbUser = await prisma.user.create({
      data: {
        id: authUser.user.id,
        email,
        firstName,
        lastName,
        role: org.ssoDefaultRole,
        organizationId: org.id,
      },
    })

    logger.info('sso:callback', 'Yeni SSO kullanicisi olusturuldu', { email, orgId: org.id })
  }

  // Kullanicinin organizasyonu dogrula — baska org'a SSO ile sizmay onle
  if (dbUser.organizationId && dbUser.organizationId !== org.id) {
    logger.warn('sso:callback', 'SSO kullanicisi farkli org\'a ait', {
      email,
      userOrgId: dbUser.organizationId,
      ssoOrgId: org.id,
    })
    return NextResponse.redirect(new URL('/auth/login?error=sso_org_mismatch', request.url))
  }

  // Generate magic link for the user (passwordless SSO login)
  const appUrl = getAppUrl()
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    logger.error('sso:callback', 'Magic link olusturulamadi', linkError?.message)
    return NextResponse.redirect(new URL('/auth/login?error=sso_session_failed', request.url))
  }

  // Redirect to Supabase verify endpoint to establish session
  const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/callback`)}`

  logger.info('sso:callback', 'SSO giris basarili', { email, orgId: org.id })

  return NextResponse.redirect(verifyUrl)
}
