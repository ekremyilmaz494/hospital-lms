import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getRateLimitCount, incrementRateLimit, deleteRateLimit } from '@/lib/redis'
import { createLoginClient, createServiceClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { maskEmail, maskIp } from '@/lib/pii-mask'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity-logger'
import { isDeviceTrusted } from '@/lib/auth/trusted-device'
import { getAccountLock, registerFailedLogin, LOGIN_LOCK } from '@/lib/auth/login-lock'
import { isIpAllowed } from '@/lib/auth/ip-allowlist'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import { hashTcKimlik } from '@/lib/tc-crypto'
import { isOnPrem } from '@/lib/deployment'
import { getLicenseState } from '@/lib/license/cache'
import { LICENSE_STATE_COOKIE } from '@/lib/license/enforcement'
import { verifyAccessToken } from '@/lib/supabase/verify-jwt'

/**
 * "SMS MFA pending" sentinel cookie.
 * Login sonrası org.smsMfaEnabled=true VE cihaz trusted değilse set edilir.
 * Middleware bu cookie'yi gören protected route isabetinde kullanıcıyı
 * /auth/sms-verify'a yönlendirir. /api/auth/sms/verify başarılı olunca silinir.
 */
const SMS_PENDING_COOKIE = 'hlms-sms-pending'
const SMS_PENDING_TTL = 15 * 60 // 15 dk — SMS doğrulama için makul süre

const MUST_CHANGE_PW_COOKIE = 'hlms-must-change-pw'

/**
 * "Bu cihazda oturumumu açık tut (7 gün)" sentinel cookie.
 * Supabase token'ını her refresh'te middleware bu cookie'yi okuyup auth
 * cookie'lerine 7 gün maxAge ekliyor (yoksa Supabase default'u session-only
 * olduğu için tarayıcı kapanınca oturum düşüyordu).
 */
const REMEMBER_ME_COOKIE = 'hlms-remember-me'
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

/**
 * Trusted IP extraction for Vercel deployments.
 * On Vercel, x-vercel-forwarded-for is set by the platform and cannot be spoofed
 * by clients (unlike x-forwarded-for which is a user-controlled header).
 * Falls back to x-forwarded-for for non-Vercel environments (still spoofable —
 * acceptable for rate limiting since worst case: attacker uses different IPs).
 */
function getTrustedIp(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** Threshold of consecutive failures before alerting admin */
const ALERT_THRESHOLD = 5

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      // Yeni: tek alan — kullanıcı email veya TC girer, sistem otomatik anlar
      identifier?: string
      // Backward-compat: eski clientlardan email/tcKimlik gelirse kabul et
      email?: string
      tcKimlik?: string
      password?: string
      rememberMe?: boolean
      // Subdomain'de orgSlug var → TC lookup tek org'a scope'lanır.
      // Apex'te orgSlug yoksa TC tüm aktif org'larda aranır.
      orgSlug?: string
    }
    const { password, rememberMe = false, orgSlug } = body
    const rawIdentifier = (body.identifier ?? body.email ?? body.tcKimlik ?? '').trim()

    if (!password) {
      return errorResponse('Şifre gereklidir.', 400)
    }
    if (!rawIdentifier) {
      return errorResponse('E-posta veya TC Kimlik No gereklidir.', 400)
    }

    // Tip tespiti: 11 haneli sayı → TC, '@' içeriyorsa → email, başka format → reddet
    const looksLikeTc = /^\d{11}$/.test(rawIdentifier)
    const looksLikeEmail = rawIdentifier.includes('@')

    if (!looksLikeTc && !looksLikeEmail) {
      return errorResponse('Geçerli bir e-posta veya 11 haneli TC Kimlik No girin.', 400)
    }

    // L25: TC enumeration'ı sınırla — IP rate-limit kontrolü TC→email çözümünden ÖNCE.
    // Önceden rate-limit yalnız çözümden SONRA çalıştığından, TC tarama (DB lookup +
    // differential 401/409 yanıtları) hız limitsizdi. Artık her TC denemesi bütçe tüketir.
    const ip = getTrustedIp(request)
    if ((await getRateLimitCount(`login-ip:${ip}`)) >= 100) {
      logger.warn('auth:login', 'IP rate limit aşıldı (lookup öncesi)', { ip: maskIp(ip) })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }

    // KVKK: TC plaintext sadece bu request lifetime'ı içinde; hash'lenir, atılır.
    let normalizedEmail: string
    if (looksLikeTc) {
      const tc = normalizeTcKimlik(rawIdentifier)
      if (!isValidTcKimlik(tc)) {
        void incrementRateLimit(`login-ip:${ip}`, 300).catch(() => {})
        return errorResponse('TC Kimlik No veya şifre hatalı.', 401)
      }

      const tcHash = hashTcKimlik(tc)
      // Subdomain'de orgSlug → tek org'a scope. Apex'te → tüm aktif org'lar.
      const matches = await prisma.user.findMany({
        where: {
          tcHash,
          isActive: true,
          organization: orgSlug
            ? { slug: orgSlug, isActive: true }
            : { isActive: true },
        },
        select: {
          email: true,
          organization: { select: { slug: true, name: true } },
        },
        take: 5,
      })

      if (matches.length === 0) {
        // L25: eşleşme yok da bütçe tüketsin — aksi halde "TC kayıtlı mı?" oracle'ı bedava taranır.
        void incrementRateLimit(`login-ip:${ip}`, 300).catch(() => {})
        return errorResponse('TC Kimlik No veya şifre hatalı.', 401)
      }

      // Tek-org politikası: bir kişi yalnızca BİR kuruma bağlı olmalı. Aynı TC birden
      // fazla aktif kurumda eşleşiyorsa (eski/hatalı veri) org SEÇİMİ SUNULMAZ — giriş
      // reddedilir ve yöneticinin fazladan kaydı temizlemesi gerekir. (401 değil; şifre
      // denemesi sayılmasın — veri sorunu, kimlik bilgisi sorunu değil.)
      if (matches.length > 1) {
        // L25: çok-org 409 ürün kararı gereği korunur (#205 tek-org politikası) ama enumeration
        // oracle'ı olmaması için bütçe tüketir.
        void incrementRateLimit(`login-ip:${ip}`, 300).catch(() => {})
        return errorResponse(
          'Hesabınız birden fazla kuruma bağlı görünüyor. Lütfen kurum yöneticinizle iletişime geçin.',
          409,
        )
      }

      normalizedEmail = matches[0].email.trim().toLowerCase()
    } else {
      normalizedEmail = rawIdentifier.toLowerCase()
    }

    // ── Supabase client önce oluştur — cookies() async context'i Promise.all içinde
    // kaybolursa session cookie'leri response'a yazılmaz (Next.js 15+ AsyncLocalStorage bug).
    const supabase = await createLoginClient(rememberMe)
    // ── Rate limiting: Supabase client'tan bağımsız, paralel çalışabilir ──
    const [ipCount, emailCount] = await Promise.all([
      getRateLimitCount(`login-ip:${ip}`),
      getRateLimitCount(`login:${normalizedEmail}`),
    ])
    if (ipCount >= 100) {
      logger.warn('auth:login', 'IP rate limit aşıldı', { ip: maskIp(ip) })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }
    if (emailCount >= 30) {
      logger.warn('auth:login', 'E-posta rate limit aşıldı', { email: maskEmail(normalizedEmail) })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }

    // Hesap kilidi: ardışık başarısız denemeler eşiği aşmışsa giriş geçici engellenir
    // (IP rate-limit'in aksine saldırgan IP değiştirse de hesap korunur).
    const accountLock = await getAccountLock(normalizedEmail)
    if (accountLock.locked) {
      logger.warn('auth:login', 'Kilitli hesaba giriş denemesi', { email: maskEmail(normalizedEmail), ip: maskIp(ip) })
      const mins = Math.max(1, Math.ceil(accountLock.retryAfterSec / 60))
      return errorResponse(
        `Çok fazla hatalı deneme nedeniyle hesabınız geçici olarak kilitlendi. ${mins} dakika sonra tekrar deneyin.`,
        423,
      )
    }

    const authTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), 12000)
    )
    const authResult = await Promise.race([
      supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
      authTimeout,
    ])
    let data = authResult.data
    const authError = authResult.error

    if (authError) {
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: maskEmail(normalizedEmail), ip: maskIp(ip), reason: authError.message, code: authError.status })

      // Sadece başarısız girişlerde rate limit sayacını artır
      void Promise.all([
        incrementRateLimit(`login-ip:${ip}`, 300),
        incrementRateLimit(`login:${normalizedEmail}`, 300),
      ]).catch(() => {})

      // Ardışık başarısızlıkları say + eşik aşılırsa hesabı kilitle — fire-and-forget.
      void (async () => {
        try {
          const { failCount } = await registerFailedLogin(normalizedEmail)
          if (failCount === ALERT_THRESHOLD) {
            const adminEmail = process.env.ADMIN_ALERT_EMAIL
            if (adminEmail) {
              sendEmail({
                to: adminEmail,
                subject: `[Güvenlik Uyarısı] ${normalizedEmail} için ${ALERT_THRESHOLD} başarısız giriş denemesi`,
                html: `<p>IP: <strong>${ip}</strong><br>E-posta: <strong>${normalizedEmail}</strong><br>Zaman: ${new Date().toLocaleString('tr-TR')}</p><p>Bu kişi hesabına erişmeye çalışıyor olabilir. Hesap ${LOGIN_LOCK.threshold} başarısız denemede ${Math.round(LOGIN_LOCK.durationSec / 60)} dakika kilitlenir. Lütfen kontrol edin.</p>`,
              }).catch(err => logger.warn('LoginAlert', 'Guvenlik uyari emaili gonderilemedi', (err as Error).message))
            }
          }
        } catch { /* Redis failure tracking is best-effort */ }
      })()

      return errorResponse(
        looksLikeTc ? 'TC Kimlik No veya şifre hatalı.' : 'E-posta veya şifre hatalı.',
        401,
      )
    }
    if (!data.user) {
      return errorResponse(
        looksLikeTc ? 'TC Kimlik No veya şifre hatalı.' : 'E-posta veya şifre hatalı.',
        401,
      )
    }

    let signedInUser = data.user
    let signedInSession = data.session

    // ── Orphan user detection + active check ──
    const dbUser = await prisma.user.findUnique({
      where: { id: signedInUser.id },
      select: {
        id: true,
        mustChangePassword: true,
        isActive: true,
        role: true,
        organizationId: true,
        phone: true,
        phoneVerifiedAt: true,
        organization: { select: { slug: true, isActive: true, isSuspended: true, smsMfaEnabled: true, setupCompleted: true, ipAllowlistEnabled: true, ipAllowlist: true } },
      }
    })

    if (!dbUser) {
      // Orphan user — exists in Supabase Auth but not in DB
      return jsonResponse(
        { error: 'Hesabınız sistemde kayıtlı değil. Yöneticinizle iletişime geçin.' },
        403
      )
    }

    if (!dbUser.isActive) {
      return jsonResponse(
        { error: 'Hesabınız devre dışı bırakılmış. Yöneticinizle iletişime geçin.' },
        403
      )
    }

    // Org pasif/askıya alınmışsa (örn. demo iptali) giriş ekranında temiz ret — super_admin muaf.
    // checkOrgActive (api-helpers.ts) ile birebir aynı kural/mesaj; aksi halde kullanıcı girip
    // her API'den 403 alırdı.
    if ((!dbUser.organization?.isActive || dbUser.organization?.isSuspended) && dbUser.role !== 'super_admin') {
      return jsonResponse(
        { error: 'Kurumunuzun erişimi askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.' },
        403
      )
    }

    // On-prem lisans kapısı — kilitli/lisanssızsa staff giremez (temiz ret);
    // admin/super_admin girip /license aktivasyon ekranına düşer. Sentinel çerezi
    // aşağıda (başarılı giriş bloğunda) set edilir.
    if (isOnPrem()) {
      const licenseState = (await getLicenseState()).state
      const locked = licenseState === 'LOCKED' || licenseState === 'NO_LICENSE'
      if (locked && dbUser.role === 'staff') {
        return jsonResponse(
          { error: 'Sistem lisansı geçerli değil. Lütfen kurum yöneticinizle iletişime geçin.' },
          403,
        )
      }
    }

    // IP allowlist — org açtıysa yalnız izinli IP/CIDR'lerden giriş yapılabilir.
    // super_admin (platform operatörü) muaftır; SMS MFA muafiyetiyle aynı gerekçe.
    if (dbUser.organization?.ipAllowlistEnabled && dbUser.role !== 'super_admin') {
      if (!isIpAllowed(ip, dbUser.organization.ipAllowlist)) {
        logger.warn('auth:login', 'IP allowlist disi giris denemesi', { email: maskEmail(normalizedEmail), ip: maskIp(ip) })
        return jsonResponse(
          { error: 'Bu IP adresinden erişime izin verilmiyor. Kurum yöneticinizle iletişime geçin.' },
          403,
        )
      }
    }

    const authAppMetadata = (signedInUser.app_metadata ?? {}) as Record<string, unknown>
    const authRole = typeof authAppMetadata.role === 'string' ? authAppMetadata.role : undefined
    const authOrgId = typeof authAppMetadata.organization_id === 'string' ? authAppMetadata.organization_id : undefined
    const expectedRole = dbUser.role
    const expectedOrgId = dbUser.organizationId ?? undefined

    if (authRole !== expectedRole || (expectedRole !== 'super_admin' && authOrgId !== expectedOrgId)) {
      try {
        const adminClient = await createServiceClient()
        const nextAppMetadata: Record<string, unknown> = {
          ...authAppMetadata,
          role: expectedRole,
        }
        if (expectedOrgId) {
          nextAppMetadata.organization_id = expectedOrgId
        } else {
          delete nextAppMetadata.organization_id
        }

        const { error: metadataError } = await adminClient.auth.admin.updateUserById(signedInUser.id, {
          app_metadata: nextAppMetadata,
        })
        if (metadataError) throw metadataError

        // Metadata değiştiyse yeni access token mint et; middleware role kararını JWT'den verir.
        const refreshed = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (refreshed.error || !refreshed.data.user || !refreshed.data.session) {
          throw refreshed.error ?? new Error('metadata_refreshed_session_missing')
        }
        data = refreshed.data
        signedInUser = refreshed.data.user
        signedInSession = refreshed.data.session
      } catch (err) {
        logger.warn('auth:login', 'Auth metadata kanonik DB rolüyle eşitlenemedi', {
          userId: dbUser.id,
          role: expectedRole,
          organizationId: expectedOrgId ?? null,
          error: err instanceof Error ? err.message : String(err),
        })
        await supabase.auth.signOut().catch(() => {})
        return errorResponse('Oturum bilgileriniz güncellenemedi. Lütfen tekrar deneyin.', 500)
      }
    }

    const role = dbUser.role
    const verifiedSession = signedInSession?.access_token
      ? await verifyAccessToken(signedInSession.access_token)
      : null
    const verifiedOrgId = (verifiedSession?.payload.app_metadata as Record<string, unknown> | undefined)?.organization_id
    const jwtOrgOk = role === 'super_admin' || verifiedOrgId === expectedOrgId
    if (!verifiedSession || verifiedSession.role !== role || !jwtOrgOk) {
      logger.warn('auth:login', 'JWT metadata DB rolüyle eşleşmiyor', {
        userId: dbUser.id,
        role,
        jwtRole: verifiedSession?.role ?? null,
        organizationId: expectedOrgId ?? null,
        jwtOrganizationId: typeof verifiedOrgId === 'string' ? verifiedOrgId : null,
      })
      await supabase.auth.signOut().catch(() => {})
      return errorResponse('Oturum bilgileriniz güncellenemedi. Lütfen tekrar deneyin.', 500)
    }

    // MFA check — session'daki factors bilgisinden kontrol et (HTTP call YOK).
    // signInWithPassword() response'unda user.factors her zaman döner.
    // Fallback API call'ı kaldırıldı — gereksiz ~400-800ms HTTP round-trip.
    const sessionFactors = signedInSession?.user?.factors
    const activeFactor = sessionFactors?.find(
      (f: { factor_type: string; status: string }) => f.factor_type === 'totp' && f.status === 'verified'
    ) as { id: string } | undefined

    if (activeFactor) {
      logger.info('auth:login', 'MFA gerekli', { userId: signedInUser.id, role })
      return jsonResponse({
        mfaRequired: true,
        factorId: activeFactor.id,
        mustChangePassword: dbUser.mustChangePassword,
      })
    }

    // ── SMS MFA check ──
    // Org smsMfaEnabled=true ise cihaz trusted olmadıkça SMS doğrulaması ZORUNLU.
    // Super admin platform operatörü, hastane policy'sinden muaf.
    const smsMfaEnabled = dbUser.organization?.smsMfaEnabled ?? false
    if (smsMfaEnabled && role !== 'super_admin') {
      const deviceTrusted = await isDeviceTrusted(signedInUser.id).catch(() => false)
      if (!deviceTrusted) {
        const cookieStore = await cookies()
        cookieStore.set(SMS_PENDING_COOKIE, '1', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: SMS_PENDING_TTL,
        })

        logger.info('auth:login', 'SMS MFA gerekli', { userId: signedInUser.id, hasPhone: !!dbUser.phone })
        return jsonResponse({
          smsMfaRequired: true,
          phoneMissing: !dbUser.phone,
          // Telefonun son 4 hanesi — UI'da "****3456 numaralı telefonunuza kod gönderildi" göstermek için
          phoneMasked: dbUser.phone ? `****${dbUser.phone.slice(-4)}` : null,
          mustChangePassword: dbUser.mustChangePassword,
        })
      }
    }

    // Başarılı giriş — fail counter + hesap kilidi sıfırla
    void Promise.all([
      deleteRateLimit(`login:${normalizedEmail}`),
      deleteRateLimit(`login-fail:${normalizedEmail}`),
      deleteRateLimit(`login-locked:${normalizedEmail}`),
    ]).catch(() => {})

    // "7 gün açık tut" sentinel cookie — middleware refresh'te okuyup maxAge uygulayacak
    const cookieStore = await cookies()
    if (rememberMe) {
      cookieStore.set(REMEMBER_ME_COOKIE, '1', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SEVEN_DAYS_SECONDS,
      })
    } else {
      // Önceki login'den kalan sentinel varsa temizle
      cookieStore.set(REMEMBER_ME_COOKIE, '', {
        path: '/',
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
      })
    }

    // Şifre değiştirme zorunluluğu — middleware bu cookie'yi görünce /auth/change-password'a zorlar
    if (dbUser.mustChangePassword) {
      cookieStore.set(MUST_CHANGE_PW_COOKIE, '1', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60,
      })
    } else {
      // Önceki oturumdan kalan cookie varsa temizle
      cookieStore.set(MUST_CHANGE_PW_COOKIE, '', {
        path: '/',
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
      })
    }

    // On-prem lisans durumu sentinel çerezi — middleware kilitli/lisanssızda
    // sayfa navigasyonunu /license'a yönlendirir (advisory; asıl zorlama API+layout).
    if (isOnPrem()) {
      const licenseState = (await getLicenseState()).state
      const locked = licenseState === 'LOCKED' || licenseState === 'NO_LICENSE'
      cookieStore.set(LICENSE_STATE_COOKIE, locked ? 'locked' : 'ok', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60,
      })
    }

    logger.info('auth:login', 'Basarili giris', { userId: signedInUser.id, role })

    void logActivity({
      userId: signedInUser.id,
      organizationId: dbUser.organizationId ?? '',
      action: 'login',
      ipAddress: ip,
    })

    // Multi-tenant cross-subdomain redirect:
    // - Apex'ten login olan kullanıcı → kendi org'unun subdomain'ine atılır.
    // - Subdomain'den login olan kullanıcı → aynı domain'de kalır (redirectTo null).
    // - super_admin → her durumda apex'te /super-admin/dashboard.
    // Frontend `window.location.href = redirectTo ?? <samepath>` ile zıplar.
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? ''
    const useSubdomain = baseDomain && !baseDomain.includes('localhost') && !baseDomain.includes(':')
    const requestHost = request.headers.get('host') ?? ''
    const onApex = requestHost === baseDomain || requestHost === `www.${baseDomain}`

    let redirectTo: string | null = null
    if (useSubdomain && onApex && dbUser.organization?.slug && role !== 'super_admin') {
      const proto = request.headers.get('x-forwarded-proto') ?? 'https'
      const dashboardPath = role === 'admin'
        ? '/admin/dashboard'
        : role === 'staff'
          ? '/staff/dashboard'
          : '/auth/login'
      redirectTo = `${proto}://${dbUser.organization.slug}.${baseDomain}${dashboardPath}`
    }

    return jsonResponse({
      user: {
        id: signedInUser.id,
        email: signedInUser.email,
        role: role ?? 'staff',
      },
      mustChangePassword: dbUser.mustChangePassword,
      // Admin layout setup-wizard guard'ı için: ilk login'de ekstra /api/admin/setup
      // fetch'ini atlayabilsin. dbUser.organization.setupCompleted gerçek kaynak.
      setupCompleted: dbUser.organization?.setupCompleted ?? null,
      // Multi-tenant subdomain redirect için: apex login → subdomain dashboard'a zıpla.
      // Subdomain login → null, frontend role-based same-domain push yapar.
      redirectTo,
      organizationSlug: dbUser.organization?.slug ?? null,
      // Mobile app için: tenant'ı header'da göndereceği için ID lazım.
      organizationId: dbUser.organizationId ?? null,
      // Mobile app için JWT bilgileri. Web tarafı cookie'yi kullandığı için bu alanları ignore eder.
      // Mobile, response'tan alıp expo-secure-store'a yazar; sonraki istekleri Authorization: Bearer ile yapar.
      session: signedInSession ? {
        accessToken: signedInSession.access_token,
        refreshToken: signedInSession.refresh_token,
        expiresAt: signedInSession.expires_at ?? null,
        tokenType: signedInSession.token_type,
      } : null,
    })
  } catch (err) {
    logger.error('auth:login', 'Giriş işlemi sırasında beklenmeyen hata', err)
    return errorResponse('Bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }
}
