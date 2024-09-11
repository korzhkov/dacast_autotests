const { test: base, expect } = require('@playwright/test');
const { setupAuth } = require('./helpers/auth');
require('dotenv').config();

const test = base.extend({
  page: async ({ page }, use) => {
    await setupAuth(page);
    await use(page);
  },
});

module.exports = { test, expect };