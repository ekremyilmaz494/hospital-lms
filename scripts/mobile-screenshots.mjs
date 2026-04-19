import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'e2e-staff@test.local';
const STAFF_PASS  = process.env.E2E_STAFF_PASSWORD || 'E2eTestStaff123!';
const OUT_DIR = process.argv[2] || 'screenshots/mobile-before';

const pages = [
  { name: '01-dashboard',       url: '/staff/dashboard' },
  { name: '02-my-trainings',    url: '/staff/my-trainings' },
  { name: '03-certificates',    url: '/staff/certificates' },
  { name: '04-calendar',        url: '/staff/calendar' },
  { name: '05-evaluations',     url: '/staff/evaluations' },
  { name: '06-notifications',   url: '/staff/notifications' },
  { name: '07-profile',         url: '/staff/profile' },
  { name: '08-smg',             url: '/staff/smg' },
  { name: '09-kvkk',            url: '/staff/kvkk' },
  { name: '10-drawer-open',     url: '/staff/dashboard', openDrawer: true },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'tr-TR',
});
// Çerez banner'ını baştan kapat
await ctx.addInitScript(() => {
  localStorage.setItem('lms_cookie_consent', 'true');
  localStorage.setItem('lms_cookie_prefs', JSON.stringify({ necessary: true, functional: true, analytics: false }));
});
const page = await ctx.newPage();

// Login
console.log('→ Login...');
await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
// Çerez banner'ını kabul et
const acceptCookie = page.locator('button:has-text("Tümünü Kabul")').first();
if (await acceptCookie.count()) {
  await acceptCookie.click().catch(() => {});
  await page.waitForTimeout(500);
}
await page.fill('input[type="email"], input[name="email"]', STAFF_EMAIL);
await page.fill('input[type="password"], input[name="password"]', STAFF_PASS);
await Promise.all([
  page.waitForURL(/\/staff\//, { timeout: 25000 }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(2500);
console.log('✓ URL:', page.url());

// Dev badge'i gizle
await page.addStyleTag({ content: `
  [data-nextjs-toast], nextjs-portal, [data-nextjs-dev-tools-button] { display: none !important; }
`}).catch(() => {});

for (const p of pages) {
  try {
    await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3500);
    await page.addStyleTag({ content: `
      [data-nextjs-toast], nextjs-portal, [data-nextjs-dev-tools-button] { display: none !important; }
    `}).catch(() => {});
    if (p.openDrawer) {
      // "Daha Fazla" butonuna bas
      const btn = page.locator('nav button:has-text("Daha Fazla")').first();
      if (await btn.count()) await btn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${OUT_DIR}/${p.name}.png`, fullPage: false });
    console.log(`✓ ${p.name}`);
  } catch (e) {
    console.error(`✗ ${p.name}:`, e.message);
  }
}

await browser.close();
console.log(`\nDone → ${OUT_DIR}`);
