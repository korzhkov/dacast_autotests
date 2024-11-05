const { test: base, expect } = require('@playwright/test');
const { setupAuth } = require('./helpers/auth');
const { getEnvVars } = require('./helpers/envHelper');
require('dotenv').config();

// Extend the base test with custom page fixture
const test = base.extend({
  // Custom page fixture that handles both basic auth and login
  page: async ({ browser }, use) => {
    // Get environment from command line or default to prod
    const env = process.env.WORKENV || 'prod';
    // Get basic auth credentials for the environment
    const { basicAuthUser, basicAuthPassword } = getEnvVars(env);
    
    // Create browser context with basic auth if credentials exist (dev/stage)
    // or without auth for environments that don't need it (prod)
    const context = basicAuthUser && basicAuthPassword 
      ? await browser.newContext({
          httpCredentials: {
            username: basicAuthUser,
            password: basicAuthPassword
          }
        })
      : await browser.newContext();
    
    // Create new page, perform login, and cleanup after use
    const page = await context.newPage();
    await setupAuth(page);  // Login through UI
    await use(page);        // Let test use the authenticated page
    await context.close();  // Cleanup after test
  },
});

module.exports = { test, expect };