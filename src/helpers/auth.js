const { getEnvVars } = require('./envHelper');

async function login(page, host, username, password) {
  await page.goto(`https://${host}/login`);
  await page.getByLabel('Email').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

async function setupAuth(page) {
  const { host, username, password } = getEnvVars(process.env.WORKENV);
  await login(page, host, username, password);
}

module.exports = { login, setupAuth };
