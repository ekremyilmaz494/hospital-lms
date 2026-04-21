import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = '/tmp/login-shots';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-accelerated-2d-canvas',
  ],
});
const sizes = [
  { name: 'forgot-form', width: 1366, height: 768, wait: 1500, url: '/auth/forgot-password' },
  { name: 'forgot-success', width: 1366, height: 768, wait: 1500, url: '/auth/forgot-password', fillEmail: true },
];

for (const s of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    locale: 'tr-TR',
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true');
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ necessary: true, functional: true, analytics: false }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.log('PAGEERR:', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE-ERR:', msg.text());
  });
  const target = s.url ? `http://localhost:3000${s.url}` : 'http://localhost:3000/auth/login';
  await page.goto(target, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(s.wait ?? 1200);
  if (s.fillEmail) {
    // Simulate the success state by setting the React state via the input then submit
    await page.fill('input[type="email"]', 'test@hospital.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
  }
  const path = `${OUT}/${s.name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`${s.name} -> ${path}`);
  await ctx.close();
}
await browser.close();
