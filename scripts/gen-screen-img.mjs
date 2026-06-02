/**
 * Telefon ekranı görselleri (fal.ai Recraft V3 digital_illustration — raster).
 * drawImage ile Canvas2D ekranlarına basılır (video thumbnail vb.).
 * Çıktı: apps/web/public/landing-3d/screen-*.png
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-screen-img.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error("FAL_KEY yok."); process.exit(1); }

const OUT_DIR = path.resolve("apps/web/public/landing-3d");
const COLORS = [
  { r: 13, g: 150, b: 104 },
  { r: 245, g: 158, b: 11 },
  { r: 26, g: 58, b: 40 },
];

const SPECS = [
  {
    file: "screen-hero.png",
    size: "landscape_4_3",
    prompt:
      "Flat digital illustration, healthcare team online training session: a diverse group " +
      "of medical staff in scrubs watching an e-learning video on a large screen in a calm " +
      "modern clinic classroom, laptops and notes, warm and welcoming, clean simple shapes, " +
      "emerald green and warm amber palette, professional, centered, no text, no words, no letters.",
  },
];

async function gen(spec) {
  const res = await fetch("https://fal.run/fal-ai/recraft-v3", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: spec.prompt,
      image_size: spec.size ?? "landscape_16_9",
      style: "digital_illustration",
      colors: COLORS,
    }),
  });
  if (!res.ok) throw new Error(`${spec.file}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`${spec.file}: url yok`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, spec.file), buf);
  console.log(`✓ ${spec.file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

for (const s of SPECS) await gen(s).catch((e) => { console.error("✗", e.message); process.exitCode = 1; });
