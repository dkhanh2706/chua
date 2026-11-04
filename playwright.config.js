const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3001', channel: 'chrome', headless: true },
  webServer: { command: 'node server.js', url: 'http://127.0.0.1:3001', env: { PORT: '3001' }, reuseExistingServer: false },
});
