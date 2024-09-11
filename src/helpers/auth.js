async function login(page, host, username, password) {
  await page.goto(`https://${host}/login`);
  await page.getByLabel('Email').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

async function setupAuth(page) {
  const host = process.env._HOST;
  const username = process.env._USERNAME;
  const password = process.env._PASSWORD;

  await login(page, host, username, password);
}

module.exports = { login, setupAuth };