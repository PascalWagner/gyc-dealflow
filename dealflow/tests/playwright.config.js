const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1400, height: 900 },
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
});
