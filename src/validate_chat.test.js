const { test, expect } = require('@playwright/test');
require('dotenv').config();

test('Dacast chat test', async ({ page }) => {
  const host = process.env._HOST;
 // Note: We're using the `page` fixture provided by Playwright Test

  test.setTimeout(120000); // Increase overall test timeout to 2 minutes


  await test.step('Navigate and check Matomo', async () => {
    console.log('Navigating to main page of dacast.com');
    await page.goto(`https://${host}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.getByRole('heading', { name: 'This website uses cookies' }).click();
    console.log('GDPR banner found');
    console.log('Navigation completed, waiting for Matomo request');

    let matomoRequest = null;
    const matomoPromise = page.waitForRequest(
      request => {
        if (request.url().includes('https://matomo.dacast.com/matomo.php')) {
          matomoRequest = request;
          return true;
        }
        return false;
      },
      { timeout: 30000 }
    );

    try {
      await matomoPromise;
      console.log('Matomo script was requested successfully');
      if (matomoRequest) {
        console.log('Matomo request URL:', matomoRequest.url());
        console.log('Matomo request method:', matomoRequest.method());
        console.log('Matomo request headers:', matomoRequest.headers());
      }
    } catch (error) {
      console.error('Matomo request not detected:', error);
    }

    expect(matomoRequest).not.toBeNull();

    const matomoScriptExists = await page.evaluate(() => {
      return !!document.querySelector('script[src*="matomo"]');
    });
    console.log('Matomo script in DOM:', matomoScriptExists);
    expect(matomoScriptExists).toBe(true);
  });

  await test.step('Handle OK button', async () => {
    console.log('Waiting for OK button');
    await page.getByRole('button', { name: 'OK' }).waitFor({ state: 'visible', timeout: 30000 });
    console.log('OK button is visible');

    const okButton = page.getByRole('button', { name: 'OK' });
    const isEnabled = await okButton.isEnabled();
    console.log('OK button is enabled:', isEnabled);

    if (isEnabled) {
      console.log('Clicking OK button');
      await okButton.click({ force: true });
      console.log('OK button clicked');
    } else {
      console.error('OK button is not enabled');
    }

    // Check if the OK button disappeared after clicking
    const okButtonVisible = await okButton.isVisible();
    console.log('OK button is still visible after click:', okButtonVisible);

    if (okButtonVisible) {
      console.error('OK button is still visible after click, test may fail');
    }
  });

  await test.step('Open chat', async () => {
    console.log('Starting chat validation');
    
    // Wait for the Chat element to appear
    console.log('Waiting for Chat element');
    await page.waitForSelector('div:has-text("Chat")', { state: 'visible', timeout: 30000 });

    // Attempt to click on the Chat element
    console.log('Attempting to click Chat element');
    try {
      await page.locator('div').filter({ hasText: /^Chat$/ }).nth(2).click({ timeout: 5000 });
    } catch (error) {
      console.log('Failed to click Chat element, trying alternative method');
      await page.locator('div').filter({ hasText: /^Chat$/ }).first().click({ timeout: 5000 });
    }

    console.log('Chat element clicked');

    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    
    // Wait for the chat frame to appear
    console.log('Waiting for chat frame');
    const chatFrame = page.frameLocator('iframe[title="Find more information here"]');
    await chatFrame.getByTestId('message-field').waitFor({ state: 'visible', timeout: 30000 });

    console.log('Clicking message field');
    await chatFrame.getByTestId('message-field').click();
    
    console.log('Filling message field');
    await chatFrame.getByTestId('message-field').fill(`This is a test message on ${formattedDate}`);
    await page.waitForTimeout(10000);
    console.log('Chat validation completed');
  });
});