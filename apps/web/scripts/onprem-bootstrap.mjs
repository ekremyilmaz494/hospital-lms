/**
 * On-prem ilk-boot bootstrap — kurulumda İLK süper-admin hesabını oluşturur.
 *
 * SELF-CONTAINED (kasıtlı): standalone runner imajında app kaynağı (@/lib/*)
 * yoktur, yalnız derlenmiş bundle vardır. Bu yüzden bootstrap app helper'larına
 * DEĞİL, doğrudan @supabase/supabase-js (auth kullanıcısı) + pg (users satırı)
 * bağımlılıklarına dayanır — ikisi de standalone node_modules'ta mevcut.
 *
 * Idempotent: super_admin zaten varsa hiçbir şey yapmaz. entrypoint.sh çağırır.
 * Env: SUPABASE_URL (iç gateway), SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL,
 *      ONPREM_ADMIN_EMAIL, ONPREM_ADMIN_PASSWORD.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const {
  SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL,
  ONPREM_ADMIN_EMAIL,
  ONPREM_ADMIN_PASSWORD,
} = process.env

const supabaseUrl = SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL

async function main() {
  if (!DATABASE_URL) {
    console.error('[bootstrap] DATABASE_URL yok — atlanıyor.')
    return
  }
  const pool = new pg.Pool({ connectionString: DATABASE_URL })

  try {
    // Zaten super_admin var mı? (idempotent)
    const existing = await pool.query(`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`)
    if (existing.rowCount > 0) {
      console.log('[bootstrap] Süper-admin zaten var — atlanıyor.')
      return
    }

    if (!ONPREM_ADMIN_EMAIL || !ONPREM_ADMIN_PASSWORD) {
      console.error('[bootstrap] ONPREM_ADMIN_EMAIL / ONPREM_ADMIN_PASSWORD yok — süper-admin oluşturulamadı.')
      process.exitCode = 1
      return
    }
    if (!supabaseUrl || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[bootstrap] SUPABASE_URL / SERVICE_ROLE_KEY yok — süper-admin oluşturulamadı.')
      process.exitCode = 1
      return
    }

    // 1) GoTrue auth kullanıcısı — app_metadata.role=super_admin (kanonik rol),
    //    KVKK önceden onaylı (yoksa middleware her girişte login'e atar).
    // KRİTİK: acknowledged_at + notice_version BİRLİKTE yazılmalı. Yalnız
    // acknowledged_at yazılırsa middleware (isKvkkNoticeCurrent) sürüm alanını v1
    // sayar; güncel sürüm >1 ise ilk süper-admin login modalına düşer. #233
    // (tek-kaynak isKvkkNoticeCurrent) döngüyü keser ama sürümü de basmak
    // ilk-giriş modalını tamamen atlatır. Değer app kaynağındaki
    // KVKK_NOTICE_VERSION (src/lib/kvkk/notice-version.ts) ile SENKRON tutulmalı;
    // drift olursa etki yalnız ilk girişte tek modal (döngü DEĞİL, self-healing).
    const KVKK_NOTICE_VERSION = 2
    const supabase = createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase.auth.admin.createUser({
      email: ONPREM_ADMIN_EMAIL,
      password: ONPREM_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Sistem',
        last_name: 'Yöneticisi',
        kvkk_notice_acknowledged_at: new Date().toISOString(),
        kvkk_notice_version: KVKK_NOTICE_VERSION,
      },
      app_metadata: { role: 'super_admin' },
    })
    if (error || !data?.user) {
      throw new Error(`Auth kullanıcısı oluşturulamadı: ${error?.message ?? 'bilinmeyen hata'}`)
    }

    // 2) DB users satırı (organization_id NULL — platform süper-admin'i)
    try {
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, 'Sistem', 'Yöneticisi', 'super_admin', true, now(), now())`,
        [data.user.id, ONPREM_ADMIN_EMAIL],
      )
    } catch (dbErr) {
      // Rollback: auth kullanıcısını sil (orphan bırakma)
      await supabase.auth.admin.deleteUser(data.user.id).catch(() => {})
      throw dbErr
    }

    console.log(`[bootstrap] Süper-admin oluşturuldu: ${ONPREM_ADMIN_EMAIL}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('[bootstrap] Hata:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
