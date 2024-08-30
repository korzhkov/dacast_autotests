require('dotenv').config(); // to load environment variables from .env file
const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false }); // to launch browser in non-headless mode (means we can see what is happening)
    const context = await browser.newContext();
    const page = await context.newPage();

    const host = process.env._HOST; // Retrieve host from .env
    const username = process.env._USERNAME; // Retrieve username from .env
    const password = process.env._PASSWORD; // Retrieve password from .env

    // Go to the login page
    await page.goto(`https://${host}/login`);

  // Fill in the login form
    await page.getByLabel('Email').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();

    console.log('Login form submitted successfully.');

    //  Adding VOD Stream
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Live Stream', { exact: true }).click();
    await page.locator('.sc-fPrdXf > div:nth-child(4) > div').first().click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Selecting video for this livestream (first with name "sample_video.MOV")
    
    await page.locator('label').filter({ hasText: 'sample_video.MOV' }).locator('span').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    // Navigate to the LiveStreams page
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    
    // Several steps to make sure list of livestreams is loaded (probably could be optimized)
    await page.waitForTimeout(5000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log('Page refreshed. Waiting for livestreams to appear...');

    // Wait for the livestreams to load with a longer timeout
    try {
        await page.waitForSelector('a[href^="/livestreams/"]', { timeout: 30000 });
        console.log('Livestreams loaded successfully after refresh.');
    } catch (error) {
        console.error('Error: Livestreams did not appear after refresh:', error);
        throw error;
    }


// Find all livestreams links and click the first one that matches the name
const livestreamLinks = await page.$$('a[href^="/livestreams/"]');
let livestreamClicked = false;
for (const link of livestreamLinks) {
  const linkText = await link.textContent();
  if (linkText.includes('Pre-recorded stream')) {
    await link.click();
    livestreamClicked = true;
    break;
  }
}

if (!livestreamClicked) {
  throw new Error('No matching livestream found');
}

// Changing description of the video
await page.locator('textarea[type="textarea"]').click();
await page.locator('textarea[type="textarea"]').fill('This is a test livestream');

// Click outside of the text area to save the changes
await page.locator('#pageContentContainer div').filter({ hasText: 'Title Date Status Features' }).nth(2).click();

// Wait for the "Changes have been saved" text to appear
try {
  await page.waitForSelector('text="Changes have been saved"', { timeout: 5000 });
  console.log('Changes have been saved successfully.');
} catch (error) {
  console.error('Error: "Changes have been saved" text did not appear:', error);
}
  console.log('Test completed successfully.');

    await page.pause();
    
  } catch (error) {
    console.error('An error occurred:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();

/* to do
Add error handling
Add cleaning (delete livestream after test)
*/
