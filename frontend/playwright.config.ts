import { defineConfig } from '@playwright/test';
const baseURL=process.env.QAL_TEST_URL||'http://127.0.0.1:8765';
const port=Number(new URL(baseURL).port)||8765;
export default defineConfig({
  testDir: './tests', timeout: 30_000, workers: 1,
  use: { baseURL, channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: `../.venv/bin/python ../run.py --port ${port}`, url: `${baseURL}/api/health`, reuseExistingServer: true },
});
