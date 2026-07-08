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
    // Placeholder/zayıf parola reddi (savunma derinliği): .env.example verbatim kopyalanıp
    // ONPREM_ADMIN_PASSWORD=CHANGE_ME bırakılırsa admin@…/CHANGE_ME ile süper-admin ele geçirme
    // olurdu. install.sh güçlü (48-hex) parola üretir; bu kontrol yalnız İLK admin oluşturulurken
    // çalışır (üstteki idempotent-atlama geçilmişse), sonradan .env'den parola silinmesini engellemez.
    if (/change_?me/i.test(ONPREM_ADMIN_PASSWORD) || ONPREM_ADMIN_PASSWORD.length < 12) {
      console.error('[bootstrap] ONPREM_ADMIN_PASSWORD placeholder/çok kısa (min 12, CHANGE_ME yasak) — süper-admin oluşturulamadı.')
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
    // createUser başarısız olabilir çünkü önceki boot auth kullanıcısını oluşturup DB INSERT'ten
    // ÖNCE öldü (orphan). Üstteki idempotency kontrolü yalnız public.users'a bakar → orphan'ı
    // GÖRMEZ → createUser "already registered" ile patlar → sonsuz crash-loop. Kurtar: mevcut auth
    // kullanıcısını bul, rol/parolayı garanti et. Her adım tek başına idempotent → rollback GEREKMEZ.
    let authUser = data?.user
    if (error || !authUser) {
      const already = /already|registered|exist/i.test(error?.message ?? '')
      if (!already) {
        throw new Error(`Auth kullanıcısı oluşturulamadı: ${error?.message ?? 'bilinmeyen hata'}`)
      }
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) throw new Error(`Auth kullanıcı listesi alınamadı: ${listErr.message}`)
      authUser = list?.users?.find(
        (u) => (u.email ?? '').toLowerCase() === ONPREM_ADMIN_EMAIL.toLowerCase(),
      )
      if (!authUser) {
        throw new Error('Auth "already registered" dedi ama kullanıcı listede yok — elle inceleyin.')
      }
      // Yarıda kalmış olabilir → rol/parola/KVKK'yı garanti et (idempotent).
      const { error: updErr } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: ONPREM_ADMIN_PASSWORD,
        app_metadata: { role: 'super_admin' },
        user_metadata: {
          ...(authUser.user_metadata ?? {}),
          first_name: 'Sistem',
          last_name: 'Yöneticisi',
          kvkk_notice_acknowledged_at:
            authUser.user_metadata?.kvkk_notice_acknowledged_at ?? new Date().toISOString(),
          kvkk_notice_version: KVKK_NOTICE_VERSION,
        },
      })
      if (updErr) throw new Error(`Orphan auth kullanıcısı güncellenemedi: ${updErr.message}`)
      console.log('[bootstrap] Mevcut (orphan) auth kullanıcısı bulundu — rol/parola senkronlandı.')
    }

    // 2) DB users satırı (organization_id NULL — platform süper-admin'i). ON CONFLICT DO NOTHING
    //    → orphan-kurtarma / kısmi-boot tekrarında güvenli (rollback yerine idempotency).
    await pool.query(
      `INSERT INTO users (id, email, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Sistem', 'Yöneticisi', 'super_admin', true, now(), now())
       ON CONFLICT DO NOTHING`,
      [authUser.id, ONPREM_ADMIN_EMAIL],
    )

    console.log(`[bootstrap] Süper-admin oluşturuldu: ${ONPREM_ADMIN_EMAIL}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('[bootstrap] Hata:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
