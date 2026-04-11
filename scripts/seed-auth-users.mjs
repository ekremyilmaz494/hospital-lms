/**
 * Supabase Admin API ile auth kullanıcıları oluştur
 * SQL ile değil API ile — identity + user düzgün oluşur
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Devakent2026!";

const ORG_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

// public.users tablosundaki ID'lerle eşleşecek
const FIXED_USERS = [
  { id: "aa000001-0000-4000-a000-000000000001", email: "super@devakent.com", first: "Sistem", last: "Yöneticisi" },
  { id: "aa000001-0000-4000-a000-000000000002", email: "admin@devakent.com", first: "Hastane", last: "Admin" },
];

async function createUser(user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: user.first, last_name: user.last },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`  ✗ ${user.email}: ${err.msg || err.message || res.status}`);
    return false;
  }
  return true;
}

async function main() {
  console.log("=== Supabase Auth Kullanıcıları Oluşturuluyor ===\n");

  // 1) Admin + Super Admin
  console.log("1) Admin hesapları...");
  for (const u of FIXED_USERS) {
    const ok = await createUser(u);
    if (ok) console.log(`  ✓ ${u.email}`);
  }

  // 2) 100 Personel
  console.log("\n2) 100 personel hesabı...");
  let success = 0;
  let fail = 0;

  for (let n = 1; n <= 100; n++) {
    const id = `bb${String(n).padStart(6, "0")}-0000-4000-a000-000000000000`;
    const email = `personel${n}@devakent.com`;

    const ok = await createUser({ id, email, first: "Personel", last: String(n) });
    if (ok) {
      success++;
    } else {
      fail++;
    }

    // Rate limit: her 10 kullanıcıda 500ms bekle
    if (n % 10 === 0) {
      process.stdout.write(`  ... ${n}/100 (${success} ok, ${fail} fail)\r`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n  ✓ ${success} personel oluşturuldu, ${fail} hata`);
  console.log("\n=== Tamamlandı ===");
  console.log(`\nGiriş bilgileri:`);
  console.log(`  Super Admin: super@devakent.com / ${PASSWORD}`);
  console.log(`  Admin:       admin@devakent.com / ${PASSWORD}`);
  console.log(`  Personel:    personel1@devakent.com ... personel100@devakent.com / ${PASSWORD}`);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
