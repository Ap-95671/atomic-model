import { defineConfig } from '@playwright/test';
const publicTest=process.env.QAL_PUBLIC_TEST==='1';
const baseURL=process.env.QAL_TEST_URL||(publicTest?'http://127.0.0.1:8766':'http://127.0.0.1:8765');
const localBase=['127.0.0.1','localhost'].includes(new URL(baseURL).hostname);
const port=Number(new URL(baseURL).port)||8765;
export default defineConfig({
  testDir: './tests', testMatch:publicTest?'**/public.spec.ts':'**/*.spec.ts', testIgnore:publicTest?[]:['**/public.spec.ts'], timeout: 30_000, workers: 1,
  use: { baseURL, channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: localBase?{ command: publicTest?`QAL_MODE=public QAL_HOST=127.0.0.1 PORT=${port} ../.venv/bin/python ../run.py`:`../.venv/bin/python ../run.py --port ${port}`, url: `${baseURL}/api/health`, reuseExistingServer: true }:undefined,
});
