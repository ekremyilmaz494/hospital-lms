/**
 * Mevcut admin hesaplarının user_metadata'sına organization_id ekler.
 * Supabase Auth'ta organization_id eksik olan adminleri bulur ve DB'den alıp günceller.
 *
 * Kullanım: node scripts/fix-admin-org-metadata.mjs
 */
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  console.log("=== Admin Organization Metadata Fix ===\n");

  // 1) Supabase Auth'tan tüm kullanıcıları çek (pagination ile)
  let allUsers = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
      }
    );

    if (!res.ok) {
      console.error("Auth API hatası:", res.status);
      process.exit(1);
    }

    const data = await res.json();
    const users = data.users ?? data;

    if (!Array.isArray(users) || users.length === 0) break;
    allUsers.push(...users);

    if (users.length < perPage) break;
    page++;
  }

  console.log(`Toplam auth kullanıcısı: ${allUsers.length}`);

  // 2) organization_id eksik olanları filtrele
  const needsFix = allUsers.filter(
    (u) => !u.user_metadata?.organization_id
  );

  console.log(`organization_id eksik: ${needsFix.length}\n`);

  if (needsFix.length === 0) {
    console.log("Düzeltilecek kullanıcı yok.");
    await pool.end();
    return;
  }

  // 3) DB'den organization_id'leri çek
  let fixed = 0;
  let skipped = 0;

  for (const authUser of needsFix) {
    const dbResult = await pool.query(
      "SELECT organization_id, role, first_name, last_name FROM users WHERE id = $1",
      [authUser.id]
    );

    const dbUser = dbResult.rows[0];
    if (!dbUser || !dbUser.organization_id) {
      // Super admin veya DB'de kaydı yok — atla
      skipped++;
      continue;
    }

    // 4) user_metadata güncelle
    const updatedMeta = {
      ...authUser.user_metadata,
      organization_id: dbUser.organization_id,
    };

    const updateRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({ user_metadata: updatedMeta }),
      }
    );

    if (updateRes.ok) {
      fixed++;
      console.log(`  ✓ ${authUser.email} → org: ${dbUser.organization_id}`);
    } else {
      const err = await updateRes.json().catch(() => ({}));
      console.error(`  ✗ ${authUser.email}: ${err.msg || updateRes.status}`);
    }
  }

  console.log(`\n=== Sonuç ===`);
  console.log(`Düzeltildi: ${fixed}`);
  console.log(`Atlandı (super_admin / DB kaydı yok): ${skipped}`);

  await pool.end();
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
