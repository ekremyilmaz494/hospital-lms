import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

// Playwright bağımsız Node process — Next.js'in .env.local auto-load'unu görmez.
// E2E_* credentials buradan yüklenmezse global-setup ve helpers env yok diye skip eder.
dotenvConfig({ path: '.env.local' })
dotenvConfig({ path: '.env' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  // Global setup: her rol için bir kez login yap, session'ı kaydet
  globalSetup: './e2e/global-setup',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Her test action için max bekleme süresi
    actionTimeout: 15000,
    // Dev'de Turbopack lazy compile sub-resource'ları yavaşlatıyor → 60s
    // Prod'da gereksiz, ama test:e2e dev server'a karşı koşuyor (webServer.command: pnpm dev)
    navigationTimeout: 60000,
  },
  // Her test için max süre
  timeout: 60000,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
