import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  timeout: 60_000,
  workers: 1,
  globalSetup: './global-setup.mjs',
  outputDir: '../../test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...devices['Pixel 7'],
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
      args: ['--no-sandbox'],
    },
  },
  webServer: { command: 'node server.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
