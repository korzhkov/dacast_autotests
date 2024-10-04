const { test, expect } = require('@playwright/test');
require('dotenv').config();


test('Quick test', async ({ page }) => {
  const host = process.env._HOST;
  test.setTimeout(30000); // Increase the overall test timeout to 3 minutes

  console.log('Starting test');

  let testFailed = false;

  await test.step('Navigate to Dacast home page', async () => {
    try {
      await page.goto(`https://${host}/`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 12000 
      });
      console.log('Page loaded successfully');
    } catch (error) {
      console.error('Error loading page:', error);
      test.fail(error);  // Помечает шаг как неудачный
      testFailed = true;
    }
  });
/*
  await test.step('Fail by timeout', async () => {
    await expect(page.getByRole('button', { name: 'YSK' })).toBeVisible({ timeout: 2000 });
  });
*/
  await test.step('Failed test', async () => {
    try {
      await expect(page.getByRole('button', { name: 'SUPED DEAL!' })).toBeVisible({ timeout: 2000 });
      console.log('SUPED DEAL Visible');
    } catch (error) {
      console.error('Test did not complete: SUPED DEAL button is not visible');
      test.fail(error);  // Помечает шаг как неудачный
      testFailed = true;
    }
  });

  
  await test.step('Success test', async () => {
    try {
      await expect(page.getByRole('button', { name: 'OK' })).toBeVisible({ timeout: 2000 });
      console.log('OK Visible');
    } catch (error) {
        console.error('Test did not complete: OK button is not visible');
        test.fail(error);  // Помечает шаг как неудачный
        testFailed = true;
    }
  });

      
    // Waiting for the reCaptcha by-pass way implemented

  if (testFailed) {
    throw new Error('One or more steps failed');
  }

});