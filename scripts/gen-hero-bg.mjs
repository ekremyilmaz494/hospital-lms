/**
 * Landing 3D — hero arka planı (fal.ai Recraft V3 vector_illustration).
 * §3/§4 ile aynı kalın-çizgili flat illüstrasyon dili; geniş (landscape) sahne,
 * SOLDA bilinçli boşluk (hero metni için), öğeler sağ/merkezde.
 * FAL_KEY ortam değişkeninden okunur (apps/web/.env.local — commit edilmez).
 * Çıktı: apps/web/public/landing-3d/hero-bg.svg
 *
 * Çalıştır:
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-hero-bg.mjs
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
  { r: 13, g: 150, b: 104 }, // emerald
  { r: 245, g: 158, b: 11 }, // amber
  { r: 26, g: 58, b: 40 }, // olive ink
];

const prompt =
  "Wide flat vector illustration banner with bold clean outlines, medical staff training " +
  "SaaS theme. A few spread-out elements grouped on the RIGHT and CENTER: a shield with a " +
  "checkmark, an upward growth bar chart with an arrow, lush green leaves, a gear with a " +
  "check, a small report document. The LEFT third is calm empty negative space with only a " +
  "faint leaf or two. Warm off-white background, emerald green and warm amber, thick bold " +
  "outlines, flat, premium, balanced, airy, lots of breathing room, no text, no words, no letters.";

async function main() {
  const res = await fetch("https://fal.run/fal-ai/recraft-v3", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      style: "vector_illustration",
      colors: COLORS,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} — ${t.slice(0, 500)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`yanıtta url yok — ${JSON.stringify(data).slice(0, 300)}`);

  const bin = await fetch(url);
  const buf = Buffer.from(await bin.arrayBuffer());
  await mkdir(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, "hero-bg.svg");
  await writeFile(dest, buf);
  console.log(`✓ hero-bg.svg (${(buf.length / 1024).toFixed(0)} KB) → ${dest}`);
}

await main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
