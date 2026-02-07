import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'

// Load .env.test
const envFile = fs.readFileSync('.env.test', 'utf-8')
for (const line of envFile.split('\n')) {
  const [key, ...rest] = line.split('=')
  const value = rest.join('=').trim()
  if (key && value) process.env[key.trim()] = value
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.BASE_URL || 'https://workx-dashboard.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'e2e-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/session.json',
      },
      dependencies: ['auth-setup'],
    },
  ],
})
