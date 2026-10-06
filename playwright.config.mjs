import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:43188/mcu/',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run docs:preview -- --host 127.0.0.1 --port 43188',
    url: 'http://127.0.0.1:43188/mcu/',
    reuseExistingServer: false,
    timeout: 30000,
  },
})
