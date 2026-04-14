import { defineConfig, devices } from '@playwright/test'

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
    navigationTimeout: 30000,
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
