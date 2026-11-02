import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: '../.venv/bin/python ../run.py', url: 'http://127.0.0.1:8765/api/health', reuseExistingServer: true },
});
