/**
 * Merkezi kullanici olusturma helper'i.
 *
 * Tum kullanici olusturma islemleri bu fonksiyondan gecmelidir.
 * Avantajlari:
 *  - app_metadata (role, organization_id) otomatik set edilir
 *  - DB insert basarisiz olursa auth user otomatik rollback edilir
 *  - TypeScript organizationId'yi zorunlu kilar (super_admin haric)
 */
import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { encryptTcKimlik, hashTcKimlik } from '@/lib/tc-crypto'

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
      if (targets.some(t => t.includes('email'))) {
        this.safeMessage = 'Bu e-posta adresi ile kayıtlı bir personel zaten mevcut'
      } else if (targets.some(t => t.includes('tc_hash') || t.includes('tcHash'))) {
        this.safeMessage = 'Bu TC Kimlik No ile kayıtlı bir personel bu kurumda zaten mevcut'
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
  phone?: string
  title?: string
  departmentId?: string | null
  isActive?: boolean
  mustChangePassword?: boolean
  /**
   * Ham TC Kimlik No (11 hane). Verilirse `tcEncrypted` (AES-256-GCM) +
   * `tcHash` (HMAC-SHA256) olarak DB'ye yazılır. Validation çağırandan
   * beklenir (örn. createStaffSchema).
   */
  tcKimlik?: string
  /** TC'yi ekleyen admin'in user.id'si — KVKK audit için */
  tcAddedByUserId?: string
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
  // TC Kimlik No verilmişse şifrele + hash al — KVKK gereği plaintext yazılmaz
  const tcFields = isOrgUser(params) && params.tcKimlik
    ? {
        tcEncrypted: encryptTcKimlik(params.tcKimlik),
        tcHash: hashTcKimlik(params.tcKimlik),
        tcAddedAt: new Date(),
        tcAddedBy: params.tcAddedByUserId ?? null,
      }
    : {}

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
          phone: params.phone,
          title: params.title,
          departmentId: params.departmentId ?? undefined,
          isActive: params.isActive,
          mustChangePassword: params.mustChangePassword,
        }),
        ...tcFields,
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

// ── Grup yöneticisi (esas yönetici) hesabi olusturma ──

/**
 * Grup yöneticisi (esas yönetici) hesabı oluşturur (auth + DB, DB hatasında rollback).
 * `createAuthUser`'ın grup-varyantı: `role='admin'`, `organizationId=null`, `groupId` set,
 * JWT `app_metadata.group_owner=true` + `group_id` yazılır. Belirli bir hastaneye bağlı
 * DEĞİLDİR — grubun tüm hastanelerini konsolide görür + drill-in ile yönetir. Provizyon
 * Klinovax-only: yalnız super_admin grup oluşturma akışından çağrılır.
 */
export async function createGroupOwnerUser(params: {
  email: string
  password?: string
  firstName: string
  lastName: string
  groupId: string
  mustChangePassword?: boolean
  emailConfirm?: boolean
}): Promise<CreateUserResult> {
  const supabase = await createServiceClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: params.email,
    ...(params.password && { password: params.password }),
    email_confirm: params.emailConfirm ?? true,
    user_metadata: {
      first_name: params.firstName,
      last_name: params.lastName,
    },
    app_metadata: {
      role: 'admin',
      group_owner: true,
      group_id: params.groupId,
    },
  })

  if (authError || !authData.user) {
    throw new AuthUserError(authError?.message ?? 'Bilinmeyen auth hatası')
  }

  const authUserId = authData.user.id

  try {
    const dbUser = await prisma.user.create({
      data: {
        id: authUserId,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        role: 'admin',
        organizationId: null,
        groupId: params.groupId,
        mustChangePassword: params.mustChangePassword ?? true,
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

    return { authUser: { id: authUserId, email: params.email }, dbUser }
  } catch (dbError) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await supabase.auth.admin.deleteUser(authUserId)
        break
      } catch (rollbackErr) {
        if (attempt === 1) {
          logger.error('auth-user-factory', 'Grup yöneticisi rollback BASARISIZ — orphan auth user', {
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

// ── Yardimci: app_metadata guncelleme (organization olusturma icin) ──

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

// ── Yardimci: grup yöneticisi (esas yönetici) claim'leri ──

/**
 * Grup yöneticisi claim'lerini auth user'ın app_metadata'sine yazar (retry ile).
 * `group_owner=true` + `group_id=<id>` — middleware + verify-jwt buradan okur. GoTrue
 * app_metadata'yı MERGE eder (mevcut `role` korunur — updateAuthUserOrgId ile aynı varsayım).
 * Grup atama/devir sonrası çağıran ayrıca `invalidateAuthCache(userId)` çalıştırmalı.
 */
export async function updateAuthUserGroupClaims(userId: string, groupId: string): Promise<void> {
  const supabase = await createServiceClient()

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { group_owner: true, group_id: groupId },
      })
      return
    } catch (err) {
      if (attempt === 0) {
        logger.warn('auth-user-factory', 'app_metadata group claim guncelleme ilk deneme basarisiz, tekrar deneniyor', (err as Error).message)
      } else {
        logger.error('auth-user-factory', 'app_metadata group claim guncelleme BASARISIZ — manuel duzeltme gerekli', {
          userId,
          groupId,
          error: (err as Error).message,
        })
        throw err
      }
    }
  }
}

/**
 * Grup yöneticisi claim'lerini kaldırır (yetki devri/iptal). `group_owner=false` +
 * `group_id=null`. Çağıran ayrıca `invalidateAuthCache(userId)` çalıştırmalı.
 */
export async function clearAuthUserGroupClaims(userId: string): Promise<void> {
  const supabase = await createServiceClient()

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { group_owner: false, group_id: null },
      })
      return
    } catch (err) {
      if (attempt === 0) {
        logger.warn('auth-user-factory', 'app_metadata group claim temizleme ilk deneme basarisiz, tekrar deneniyor', (err as Error).message)
      } else {
        logger.error('auth-user-factory', 'app_metadata group claim temizleme BASARISIZ — manuel duzeltme gerekli', {
          userId,
          error: (err as Error).message,
        })
        throw err
      }
    }
  }
}
