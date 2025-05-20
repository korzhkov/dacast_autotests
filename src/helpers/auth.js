const { getEnvVars } = require('./envHelper');

/**
 * Performs login through UI using provided credentials
 * @param {Page} page - Playwright page object
 * @param {string} host - Host URL
 * @param {string} username - User email
 * @param {string} password - User password
 */
async function login(page, host, username, password) {
    // Navigate to login page
  await page.goto(`https://${host}/login`);

  
  // Check for cookie banner and handle it if present
  await page.waitForTimeout(5000);
  
  const cookieBanner = page.getByRole('heading', { name: 'This website uses cookies' });
  if (await cookieBanner.isVisible()) {
    await page.getByRole('button', { name: 'OK' }).click();
  }

  // Fill in credentials
  await page.locator('#email').fill(username);
  await page.locator('input[name="password"]').fill(password);
  // Submit login form
  await page.getByRole('button', { name: 'Log In' }).click();
}

/**
 * Sets up authentication for the current environment
 * @param {Page} page - Playwright page object
 */
async function setupAuth(page) {
  // Get environment from command line or default to prod
  const env = process.env.WORKENV || 'prod';
  // Get login credentials for the environment
  const { host, username, password } = getEnvVars(env);
  // Perform login
  await login(page, host, username, password);
}

module.exports = { login, setupAuth };
