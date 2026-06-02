/**
 * Landing 3D — içerikle uyumsuz kalan görsellerin onarımı (fal.ai Recraft V3).
 * - showcase-mobil.svg: showcase "Mobil Erişim" kartı (erisim.svg artık §5 arka plan
 *   manzarası olduğu için showcase'e ayrı, mobil-erişim temalı görsel).
 * - kurum.svg: §4 yeniden çerçevelendi ("Personel Yönetimi / mesai kaybı olmadan
 *   eğitin") → bina/ağ teması yerine personel/eğitim temalı görsel.
 *
 * Çalıştır:
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-fix-art.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY yok. apps/web/.env.local'den export et.");
  process.exit(1);
}

const OUT_DIR = path.resolve("apps/web/public/landing-3d");

const COLORS = [
  { r: 13, g: 150, b: 104 }, // emerald brand
  { r: 245, g: 158, b: 11 }, // amber accent
  { r: 26, g: 58, b: 40 }, // olive ink
];

const COMMON =
  " Tidy balanced composition, geometric, premium, soft rounded shapes, generous " +
  "margins and negative space, emerald green and warm amber accents on a very light " +
  "warm off-white background. Corporate medical SaaS aesthetic. No text, no words, no letters.";

const SPECS = [
  {
    // Showcase — Mobil Erişim
    file: "showcase-mobil.svg",
    prompt:
      "Minimal flat vector illustration, mobile learning and access: a smartphone showing " +
      "a training video play button and a checkmark, with a small floating progress " +
      "dashboard and a notification bell." + COMMON,
  },
  {
    // §4 — Personel Yönetimi (mesai kaybı olmadan eğitin)
    file: "kurum.svg",
    prompt:
      "Minimal flat vector illustration, staff training and completion tracking: a group of " +
      "diverse healthcare staff figures in scrubs, each with a checkmark badge, beside a " +
      "roster/checklist grid showing completed and pending items. No buildings." + COMMON,
  },
];

async function generate(spec) {
  const res = await fetch("https://fal.run/fal-ai/recraft-v3", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: spec.prompt,
      image_size: "portrait_4_3",
      style: "vector_illustration",
      colors: COLORS,
    }),
  });
  if (!res.ok) {
    throw new Error(`${spec.file}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`${spec.file}: url yok`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, spec.file), buf);
  console.log(`✓ ${spec.file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

for (const spec of SPECS) {
  try {
    await generate(spec);
  } catch (e) {
    console.error("✗", e.message);
    process.exitCode = 1;
  }
}
