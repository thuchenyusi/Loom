import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { browserName: 'chromium', channel: 'msedge', headless: true, baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 960 } },
  webServer: { command: 'npm run demo', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
