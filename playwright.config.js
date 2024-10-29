const { defineConfig, devices } = require('@playwright/test');

// Base Chrome configuration that will be used by all tests
const chromeConfig = {
  use: { 
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    permissions: ['clipboard-write'],
  },
};

const config = defineConfig({
  testDir: './src',
  stopOnFirstFailure: false,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-reports/html-report' }],
    ['./src/helpers/customReporter.js'] 
  ],
  use: {
    trace: 'on-first-retry',
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'quick2',
      testMatch: '**/quick2.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'quick',
      testMatch: '**/quick.test.js',
      use: chromeConfig.use,
    },
    {
      name: 'cleaner',
      testMatch: '**/cleaner.test.js',
      use: chromeConfig.use,
    }
  ],
});

module.exports = config;