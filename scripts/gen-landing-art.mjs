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

// §5/§6 ARKA PLAN görselleri (hero-bg gibi): geniş yatay, telefonun+metnin arkasında,
// boyu kısa bant olarak konumlanır. Öğeler ALT taban çizgisinde, üstte havadar açık
// gökyüzü/boşluk → background-position:bottom ile kısa bant öğeleri gösterir. Soluk/
// atmosferik dursun diye CSS'te opacity + üst fade uygulanır.
const BG_SIZE = "landscape_16_9";

const SPECS = [
  {
    // §5 — Mobil Erişim (her yerden, her cihazdan): doğa değil, bağlantı/network deseni.
    file: "erisim.svg",
    size: BG_SIZE,
    prompt:
      "Wide horizontal abstract background pattern, soft and airy, mobile access and " +
      "connectivity theme: large concentric wifi and signal wave arcs, scattered connection " +
      "nodes linked by thin lines, a few location pins and simple smartphone outlines, " +
      "evenly spread across the whole width with lots of empty negative space. Flat vector, " +
      "minimal, light and faded atmospheric backdrop, emerald green and warm amber accents " +
      "on a very light warm off-white background. No landscape, no hills, no trees, no " +
      "clouds, no people, no text, no words, no letters.",
  },
  {
    // §6 — Güven & Referans (güven, ortaklık, kurumsal referans).
    file: "guven.svg",
    size: BG_SIZE,
    prompt:
      "Wide horizontal background scene, soft and airy, trust and care theme: a low horizon " +
      "with subtle modern hospital buildings, soft rounded trees and clouds, and small " +
      "sparkles spread along the bottom baseline, with lots of open empty sky above. Flat " +
      "vector, minimal, light and faded atmospheric backdrop, emerald green and warm amber " +
      "accents on a very light warm off-white background. No people, no foreground objects, " +
      "no text, no words, no letters.",
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
      image_size: spec.size ?? "portrait_4_3",
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

// İsteğe bağlı filtre: `node scripts/gen-landing-art.mjs erisim` → sadece eşleşen dosya.
const only = process.argv[2];
await mkdir(OUT_DIR, { recursive: true });
for (const spec of SPECS) {
  if (only && !spec.file.includes(only)) continue;
  try {
    await generate(spec);
  } catch (e) {
    console.error("✗", e.message);
    process.exitCode = 1;
  }
}
