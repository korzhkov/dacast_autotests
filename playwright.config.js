const { defineConfig, devices } = require('@playwright/test');
// const { sendToSlack } = require('./src/helpers/slackNotifier');

module.exports = defineConfig({
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
    headless: false, // Set to true if you want to run tests in headless mode
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    ignoreHTTPSErrors: true,
  },
  projects: [
    /*{
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },*/
    {
      name: 'chrome',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        permissions: ['clipboard-write'],
      },
    },
    /*{
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-write'],
      },
    },*/
  ],
  
});