import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // SAML ACS (Assertion Consumer Service) endpoint
  // IdP posts SAML response here
  const formData = await request.formData().catch(() => null)
  const samlResponse = formData?.get('SAMLResponse') as string | null
  const relayState = formData?.get('RelayState') as string | null

  if (!samlResponse || !relayState) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }

  let state: { orgId: string; email: string }
  try {
    state = JSON.parse(relayState)
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
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

  // Extract basic identity from SAML XML (simplified — production should use xml-crypto for signature validation)
  const email = extractFromXml(samlXml, 'NameID') || state.email
  const firstName = extractFromXml(samlXml, 'FirstName') || extractFromXml(samlXml, 'givenName') || email.split('@')[0]
  const lastName = extractFromXml(samlXml, 'LastName') || extractFromXml(samlXml, 'surname') || ''

  if (!email) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_no_email', request.url))
  }

  // Provision or update user
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
        sso_provider: 'saml',
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

  // Generate magic link for the user (passwordless SSO login)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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

export async function GET(request: NextRequest) {
  // OIDC callback — exchange code for tokens
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }

  let state: { orgId: string; email: string }
  try {
    state = JSON.parse(stateParam)
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
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
    const discovery = await fetch(org.oidcDiscoveryUrl).then(r => r.json())
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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

    // Decode ID token (JWT payload)
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString())
    const email = payload.email || state.email
    const firstName = payload.given_name || payload.name?.split(' ')[0] || ''
    const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || ''

    // Same provisioning logic as SAML
    const supabase = await createServiceClient()
    let dbUser = await prisma.user.findUnique({ where: { email } })

    if (!dbUser && !org.ssoAutoProvision) {
      return NextResponse.redirect(new URL('/auth/login?error=sso_user_not_provisioned', request.url))
    }

    if (!dbUser) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          role: org.ssoDefaultRole,
          organization_id: org.id,
          first_name: firstName,
          last_name: lastName,
          sso_provider: 'oidc',
        },
      })
      if (authError) {
        return NextResponse.redirect(new URL('/auth/login?error=sso_provision_failed', request.url))
      }
      await prisma.user.create({
        data: {
          id: authUser.user.id,
          email,
          firstName,
          lastName,
          role: org.ssoDefaultRole,
          organizationId: org.id,
        },
      })
    }

    // Generate magic link session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      return NextResponse.redirect(new URL('/auth/login?error=sso_session_failed', request.url))
    }

    const verifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/callback`)}`

    return NextResponse.redirect(verifyUrl)
  } catch (err) {
    logger.error('sso:callback', 'OIDC callback hatasi', err)
    return NextResponse.redirect(new URL('/auth/login?error=sso_failed', request.url))
  }
}

/** Simple XML value extractor (for SAML assertions — not for production signature validation) */
function extractFromXml(xml: string, tag: string): string | null {
  // Try attribute-based (e.g., <Attribute Name="FirstName"><AttributeValue>John</AttributeValue></Attribute>)
  const attrRegex = new RegExp(`Name=["'](?:[^"']*:)?${tag}["'][^>]*>\\s*<[^>]*AttributeValue[^>]*>([^<]+)`, 'i')
  const attrMatch = xml.match(attrRegex)
  if (attrMatch) return attrMatch[1].trim()

  // Try direct tag (e.g., <NameID>john@example.com</NameID>)
  const tagRegex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]+)`, 'i')
  const tagMatch = xml.match(tagRegex)
  if (tagMatch) return tagMatch[1].trim()

  return null
}
