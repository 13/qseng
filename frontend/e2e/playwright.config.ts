import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Config file lives in e2e/; the Angular app (package.json, proxy.conf.json) is one level up.
const frontendRoot = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: { baseURL: 'http://localhost:4200', trace: 'on-first-retry', screenshot: 'only-on-failure', locale: 'de-DE' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    cwd: frontendRoot,
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000
  }
});
