// Playwright config: boots the static server and runs the spec against it.
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PORT || 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    // Auto-grant mic so an "Enable mic" flow never blocks (tests don't rely on it).
    permissions: ['microphone'],
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node server.js`,
    env: { PORT: String(PORT) },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
