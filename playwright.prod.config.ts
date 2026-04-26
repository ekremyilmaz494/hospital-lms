import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

// Production-path smoke: built bundle + `pnpm start` üstünde kritik akışları doğrular.
// Dev config (playwright.config.ts) Turbopack dev server'a karşı koşar; bu dosya
// bundler oddities / SSR farkları / env var eksikliklerini sadece prod build'de
// yakalayabilecek regresyonları hedefler.
//
// Kullanım (CI'da main branch + release):
//   NODE_ENV=production pnpm playwright test --config=playwright.prod.config.ts
dotenvConfig({ path: '.env.local' })
dotenvConfig({ path: '.env' })

export default defineConfig({
  testDir: './e2e',
  // Prod smoke — sadece @smoke tag'li testler koşar. Diğerleri dev config'te.
  grep: /@smoke/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0, // Prod'da intermittent gizleme yok — ilk kırılmada durur
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-prod', open: 'never' }]],
  globalSetup: './e2e/global-setup',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000, // Prod bundle'da lazy-compile yok
  },
  timeout: 45000,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 300_000, // Next.js 16 build dakika alabilir
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
