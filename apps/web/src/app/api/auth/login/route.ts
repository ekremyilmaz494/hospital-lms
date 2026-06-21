import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getRateLimitCount, incrementRateLimit, deleteRateLimit, getRedis } from '@/lib/redis'
import { createLoginClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'
import { logActivity } from '@/lib/activity-logger'
import { isDeviceTrusted } from '@/lib/auth/trusted-device'
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc'
import { hashTcKimlik } from '@/lib/tc-crypto'

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

    // KVKK: TC plaintext sadece bu request lifetime'ı içinde; hash'lenir, atılır.
    let normalizedEmail: string
    if (looksLikeTc) {
      const tc = normalizeTcKimlik(rawIdentifier)
      if (!isValidTcKimlik(tc)) {
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
        return errorResponse('TC Kimlik No veya şifre hatalı.', 401)
      }

      // Tek-org politikası: bir kişi yalnızca BİR kuruma bağlı olmalı. Aynı TC birden
      // fazla aktif kurumda eşleşiyorsa (eski/hatalı veri) org SEÇİMİ SUNULMAZ — giriş
      // reddedilir ve yöneticinin fazladan kaydı temizlemesi gerekir. (401 değil; şifre
      // denemesi sayılmasın — veri sorunu, kimlik bilgisi sorunu değil.)
      if (matches.length > 1) {
        return errorResponse(
          'Hesabınız birden fazla kuruma bağlı görünüyor. Lütfen kurum yöneticinizle iletişime geçin.',
          409,
        )
      }

      normalizedEmail = matches[0].email.trim().toLowerCase()
    } else {
      normalizedEmail = rawIdentifier.toLowerCase()
    }

    const ip = getTrustedIp(request)

    // ── Supabase client önce oluştur — cookies() async context'i Promise.all içinde
    // kaybolursa session cookie'leri response'a yazılmaz (Next.js 15+ AsyncLocalStorage bug).
    const supabase = await createLoginClient(rememberMe)
    // ── Rate limiting: Supabase client'tan bağımsız, paralel çalışabilir ──
    const [ipCount, emailCount] = await Promise.all([
      getRateLimitCount(`login-ip:${ip}`),
      getRateLimitCount(`login:${normalizedEmail}`),
    ])
    if (ipCount >= 100) {
      logger.warn('auth:login', 'IP rate limit aşıldı', { ip })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }
    if (emailCount >= 30) {
      logger.warn('auth:login', 'E-posta rate limit aşıldı', { email: normalizedEmail })
      return errorResponse('Çok fazla giriş denemesi. 5 dakika bekleyin.', 429)
    }

    const authTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), 12000)
    )
    const { data, error: authError } = await Promise.race([
      supabase.auth.signInWithPassword({ email: normalizedEmail, password }),
      authTimeout,
    ])

    if (authError) {
      logger.info('auth:login', 'Başarısız giriş denemesi', { email: normalizedEmail, ip, reason: authError.message, code: authError.status })

      // Sadece başarısız girişlerde rate limit sayacını artır
      void Promise.all([
        incrementRateLimit(`login-ip:${ip}`, 300),
        incrementRateLimit(`login:${normalizedEmail}`, 300),
      ]).catch(() => {})

      // Track consecutive failures — fire-and-forget (response'u bekletme)
      const redis = getRedis()
      if (redis) {
        const failKey = `login-fail:${normalizedEmail}`
        void (async () => {
          try {
            await redis.set(failKey, 0, { nx: true, ex: 900 })
            const failCount = await redis.incr(failKey)
            if (failCount === ALERT_THRESHOLD) {
              const adminEmail = process.env.ADMIN_ALERT_EMAIL
              if (adminEmail) {
                sendEmail({
                  to: adminEmail,
                  subject: `[Güvenlik Uyarısı] ${normalizedEmail} için ${ALERT_THRESHOLD} başarısız giriş denemesi`,
                  html: `<p>IP: <strong>${ip}</strong><br>E-posta: <strong>${normalizedEmail}</strong><br>Zaman: ${new Date().toLocaleString('tr-TR')}</p><p>Bu kişi hesabına erişmeye çalışıyor olabilir. Lütfen kontrol edin.</p>`,
                }).catch(err => logger.warn('LoginAlert', 'Guvenlik uyari emaili gonderilemedi', (err as Error).message))
              }
            }
          } catch { /* Redis failure tracking is best-effort */ }
        })()
      }

      return errorResponse(
        looksLikeTc ? 'TC Kimlik No veya şifre hatalı.' : 'E-posta veya şifre hatalı.',
        401,
      )
    }

    // ── Orphan user detection + active check ──
    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: {
        id: true,
        mustChangePassword: true,
        isActive: true,
        role: true,
        organizationId: true,
        phone: true,
        phoneVerifiedAt: true,
        organization: { select: { slug: true, smsMfaEnabled: true, setupCompleted: true } },
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

    const role = (data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | undefined

    // MFA check — session'daki factors bilgisinden kontrol et (HTTP call YOK).
    // signInWithPassword() response'unda user.factors her zaman döner.
    // Fallback API call'ı kaldırıldı — gereksiz ~400-800ms HTTP round-trip.
    const sessionFactors = data.session?.user?.factors
    const activeFactor = sessionFactors?.find(
      (f: { factor_type: string; status: string }) => f.factor_type === 'totp' && f.status === 'verified'
    ) as { id: string } | undefined

    if (activeFactor) {
      logger.info('auth:login', 'MFA gerekli', { userId: data.user?.id, role })
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
      const deviceTrusted = await isDeviceTrusted(data.user.id).catch(() => false)
      if (!deviceTrusted) {
        const cookieStore = await cookies()
        cookieStore.set(SMS_PENDING_COOKIE, '1', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: SMS_PENDING_TTL,
        })

        logger.info('auth:login', 'SMS MFA gerekli', { userId: data.user.id, hasPhone: !!dbUser.phone })
        return jsonResponse({
          smsMfaRequired: true,
          phoneMissing: !dbUser.phone,
          // Telefonun son 4 hanesi — UI'da "****3456 numaralı telefonunuza kod gönderildi" göstermek için
          phoneMasked: dbUser.phone ? `****${dbUser.phone.slice(-4)}` : null,
          mustChangePassword: dbUser.mustChangePassword,
        })
      }
    }

    // Başarılı giriş — fail counter sıfırla
    void Promise.all([
      deleteRateLimit(`login:${normalizedEmail}`),
      deleteRateLimit(`login-fail:${normalizedEmail}`),
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

    logger.info('auth:login', 'Basarili giris', { userId: data.user?.id, role })

    void logActivity({
      userId: data.user.id,
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
        id: data.user?.id,
        email: data.user?.email,
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
      session: data.session ? {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
        tokenType: data.session.token_type,
      } : null,
    })
  } catch (err) {
    logger.error('auth:login', 'Giriş işlemi sırasında beklenmeyen hata', err)
    return errorResponse('Bir hata oluştu. Lütfen tekrar deneyin.', 500)
  }
}
