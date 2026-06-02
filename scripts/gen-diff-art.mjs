/**
 * Landing 3D — §5 "farkımız" küçük spot illüstrasyonları (fal.ai Recraft V3).
 * Telefonun sağındaki farklılaştırıcı blokta dairesel rozet içinde kullanılır.
 * FAL_KEY ortam değişkeninden okunur (apps/web/.env.local — commit edilmez).
 * Çıktı: apps/web/public/landing-3d/diff-*.svg
 *
 * Çalıştır:
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-diff-art.mjs
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

const COMMON =
  " Simple flat vector spot illustration, single subject, centered, minimal, " +
  "bold clean shapes, generous padding all around, emerald green and warm amber on a " +
  "very light warm off-white background. Corporate medical SaaS aesthetic. " +
  "No text, no words, no letters.";

const SPECS = [
  {
    // İleri-sarma kilidi — gerçek izleme.
    file: "diff-video.svg",
    prompt: "A video play button combined with a small padlock." + COMMON,
  },
  {
    // Denetime hazır uyum raporu.
    file: "diff-rapor.svg",
    prompt: "A document report page with a checkmark shield badge." + COMMON,
  },
  {
    // Sağlığa özel, çok-kurumlu izolasyon.
    file: "diff-saglik.svg",
    prompt: "A modern hospital building with a small health cross heart." + COMMON,
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
      image_size: "square_hd",
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
  if (!url) throw new Error(`${spec.file}: yanıtta image url yok`);

  const img = await fetch(url);
  const buf = Buffer.from(await img.arrayBuffer());
  const dest = path.join(OUT_DIR, spec.file);
  await writeFile(dest, buf);
  console.log(`✓ ${spec.file} (${(buf.length / 1024).toFixed(0)} KB)`);
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
