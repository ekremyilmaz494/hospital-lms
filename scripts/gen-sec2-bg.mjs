/**
 * Landing 3D — §2 (Eğitim & Değerlendirme) arka planı (fal.ai Recraft V3 vector_illustration).
 * Hero ile aynı bold flat dil; geniş sahne, öğeler SOL/MERKEZ, SAĞ üçte bir boş (kopya için).
 * Çıktı: apps/web/public/landing-3d/sec2-bg.svg
 *   export $(grep '^FAL_KEY=' apps/web/.env.local) && node scripts/gen-sec2-bg.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY yok.");
  process.exit(1);
}

const OUT_DIR = path.resolve("apps/web/public/landing-3d");
const COLORS = [
  { r: 13, g: 150, b: 104 },
  { r: 245, g: 158, b: 11 },
  { r: 26, g: 58, b: 40 },
];

const prompt =
  "Wide flat vector illustration banner with bold clean outlines, online medical staff " +
  "training and assessment theme. Spread-out elements grouped on the LEFT and CENTER: a " +
  "video play button card, a checklist exam sheet with checkmarks, a certificate with a " +
  "ribbon, a small stack of books, lush green leaves. The RIGHT third is calm empty " +
  "negative space with only a faint leaf. Warm off-white background, emerald green and warm " +
  "amber, thick bold outlines, flat, premium, airy, lots of breathing room, no text, no words, no letters.";

const res = await fetch("https://fal.run/fal-ai/recraft-v3", {
  method: "POST",
  headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt,
    image_size: "landscape_16_9",
    style: "vector_illustration",
    colors: COLORS,
  }),
});
if (!res.ok) {
  console.error("✗ HTTP", res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}
const data = await res.json();
const url = data?.images?.[0]?.url;
if (!url) {
  console.error("✗ url yok", JSON.stringify(data).slice(0, 300));
  process.exit(1);
}
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
await mkdir(OUT_DIR, { recursive: true });
const dest = path.join(OUT_DIR, "sec2-bg.svg");
await writeFile(dest, buf);
console.log(`✓ sec2-bg.svg (${(buf.length / 1024).toFixed(0)} KB) → ${dest}`);
