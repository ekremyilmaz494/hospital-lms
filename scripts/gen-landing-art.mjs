/**
 * Landing 3D — §3/§4 yan alan görselleri (fal.ai Recraft V3, vector_illustration).
 * FAL_KEY ortam değişkeninden okunur (apps/web/.env.local — commit edilmez).
 * Çıktı: apps/web/public/landing-3d/{uyum,kurum}.png
 *
 * Çalıştır:
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-landing-art.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY yok. apps/web/.env.local'den export et.");
  process.exit(1);
}

const OUT_DIR = path.resolve("apps/web/public/landing-3d");

// Marka paleti (tokens.css --landing-*).
const COLORS = [
  { r: 13, g: 150, b: 104 }, // emerald brand
  { r: 245, g: 158, b: 11 }, // amber accent
  { r: 26, g: 58, b: 40 }, // olive ink
];

const SPECS = [
  {
    file: "sertifika.png",
    prompt:
      "Minimal flat vector illustration, achievement and certification theme: a " +
      "certificate document with a ribbon seal, a medal, and a checkmark, arranged as a " +
      "tidy balanced composition. Geometric, premium, soft rounded shapes, lots of " +
      "negative space, emerald green and warm amber accents on a very light warm " +
      "off-white background. Corporate medical SaaS aesthetic. No text, no words, no letters.",
  },
];

async function generate(spec) {
  const res = await fetch("https://fal.run/fal-ai/recraft-v3", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: spec.prompt,
      image_size: "portrait_4_3",
      style: "vector_illustration",
      colors: COLORS,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${spec.file}: HTTP ${res.status} — ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`${spec.file}: yanıtta image url yok — ${JSON.stringify(data).slice(0, 300)}`);

  const img = await fetch(url);
  const buf = Buffer.from(await img.arrayBuffer());
  const dest = path.join(OUT_DIR, spec.file);
  await writeFile(dest, buf);
  console.log(`✓ ${spec.file} (${(buf.length / 1024).toFixed(0)} KB) → ${dest}`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const spec of SPECS) {
  try {
    await generate(spec);
  } catch (e) {
    console.error("✗", e.message);
    process.exitCode = 1;
  }
}
