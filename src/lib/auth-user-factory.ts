/**
 * Merkezi kullanici olusturma helper'i.
 *
 * Tum kullanici olusturma islemleri bu fonksiyondan gecmelidir.
 * Avantajlari:
 *  - app_metadata (role, organization_id) otomatik set edilir
 *  - DB insert basarisiz olursa auth user otomatik rollback edilir
 *  - tcNo otomatik sifrelenir
 *  - TypeScript organizationId'yi zorunlu kilar (super_admin haric)
 */
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

// ── Hata siniflari ──────────────────────────────────────────────

export class AuthUserError extends Error {
  readonly code = 'auth_error' as const
  readonly safeMessage: string

  constructor(originalMessage: string) {
    super(originalMessage)
    this.name = 'AuthUserError'

    if (originalMessage.includes('already registered')) {
      this.safeMessage = 'Bu e-posta adresi zaten kayıtlı'
    } else if (originalMessage.includes('invalid format') || originalMessage.includes('validate email')) {
      this.safeMessage = 'Geçersiz e-posta adresi. Türkçe karakter (ş, ç, ğ, ü, ö, ı) kullanmayın.'
    } else if (originalMessage.includes('password')) {
      this.safeMessage = 'Şifre gereksinimleri karşılanmıyor'
    } else {
      this.safeMessage = 'Kullanıcı oluşturulamadı'
    }
  }
}

export class DbUserError extends Error {
  readonly code = 'db_error' as const
  readonly safeMessage: string
  readonly prismaCode?: string

  constructor(originalError: unknown) {
    const msg = originalError instanceof Error ? originalError.message : String(originalError)
    super(msg)
    this.name = 'DbUserError'

    const prismaErr = originalError as { code?: string; meta?: { target?: string[] } }
    this.prismaCode = prismaErr.code

    if (prismaErr.code === 'P2002') {
      const targets = prismaErr.meta?.target ?? []
      if (targets.some(t => t.includes('tc_no'))) {
        this.safeMessage = 'Bu TC Kimlik No ile kayıtlı bir personel zaten mevcut'
      } else if (targets.some(t => t.includes('email'))) {
        this.safeMessage = 'Bu e-posta adresi ile kayıtlı bir personel zaten mevcut'
      } else {
        this.safeMessage = 'Bu bilgilerle kayıtlı bir personel zaten mevcut'
      }
    } else {
      this.safeMessage = 'Kullanıcı veritabanına kaydedilemedi. Lütfen tekrar deneyin.'
    }
  }
}

// ── Tip tanimlari ───────────────────────────────────────────────

interface BaseParams {
  email: string
  password?: string
  firstName: string
  lastName: string
  emailConfirm?: boolean
  extraUserMetadata?: Record<string, unknown>
}

interface OrgUserParams extends BaseParams {
  role: 'admin' | 'staff'
  organizationId: string
  tcNo?: string
  phone?: string
  title?: string
  departmentId?: string | null
  hisExternalId?: string
  isActive?: boolean
  mustChangePassword?: boolean
}

interface SuperAdminParams extends BaseParams {
  role: 'super_admin'
}

export type CreateAuthUserParams = OrgUserParams | SuperAdminParams

export interface CreateUserResult {
  authUser: { id: string; email: string }
  dbUser: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    organizationId: string | null
  }
}

// ── Type guard ──────────────────────────────────────────────────

function isOrgUser(params: CreateAuthUserParams): params is OrgUserParams {
  return params.role !== 'super_admin'
}

// ── Ana fonksiyon ───────────────────────────────────────────────

/**
 * Supabase Auth + Prisma DB'de kullanici olusturur.
 * DB hatasi olursa auth user otomatik rollback edilir.
 *
 * @throws {AuthUserError} Supabase auth olusturma basarisiz
 * @throws {DbUserError} DB insert basarisiz (auth user rollback yapildi)
 */
export async function createAuthUser(params: CreateAuthUserParams): Promise<CreateUserResult> {
  const supabase = await createServiceClient()

  const organizationId = isOrgUser(params) ? params.organizationId : null

  // 1. Supabase Auth user olustur
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: params.email,
    ...(params.password && { password: params.password }),
    email_confirm: params.emailConfirm ?? true,
    user_metadata: {
      first_name: params.firstName,
      last_name: params.lastName,
      ...params.extraUserMetadata,
    },
    app_metadata: {
      role: params.role,
      ...(organizationId && { organization_id: organizationId }),
    },
  })

  if (authError || !authData.user) {
    throw new AuthUserError(authError?.message ?? 'Bilinmeyen auth hatası')
  }

  const authUserId = authData.user.id

  // 2. Prisma DB user olustur
  try {
    const dbUser = await prisma.user.create({
      data: {
        id: authUserId,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        role: params.role,
        organizationId,
        ...(isOrgUser(params) && {
          tcNo: params.tcNo ? encrypt(params.tcNo) : undefined,
          phone: params.phone,
          title: params.title,
          departmentId: params.departmentId ?? undefined,
          hisExternalId: params.hisExternalId,
          isActive: params.isActive,
          mustChangePassword: params.mustChangePassword,
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    })

    return {
      authUser: { id: authUserId, email: params.email },
      dbUser,
    }
  } catch (dbError) {
    // 3. Rollback: auth user sil
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await supabase.auth.admin.deleteUser(authUserId)
        break
      } catch (rollbackErr) {
        if (attempt === 1) {
          logger.error('auth-user-factory', 'Rollback BASARISIZ — orphan auth user', {
            userId: authUserId,
            email: params.email,
            rollbackErr,
          })
        }
      }
    }

    throw new DbUserError(dbError)
  }
}

// ── Yardimci: app_metadata guncelleme (hospital olusturma icin) ──

/**
 * Mevcut auth user'in app_metadata'sini gunceller (retry ile).
 * Hospital olusturma akisinda org_id SONRADAN eklenmesi gerektiginde kullanilir.
 */
export async function updateAuthUserOrgId(userId: string, organizationId: string): Promise<void> {
  const supabase = await createServiceClient()

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          organization_id: organizationId,
        },
      })
      return
    } catch (err) {
      if (attempt === 0) {
        logger.warn('auth-user-factory', 'app_metadata org_id guncelleme ilk deneme basarisiz, tekrar deneniyor', (err as Error).message)
      } else {
        logger.error('auth-user-factory', 'app_metadata org_id guncelleme BASARISIZ — manuel duzeltme gerekli', {
          userId,
          organizationId,
          error: (err as Error).message,
        })
        throw err
      }
    }
  }
}
