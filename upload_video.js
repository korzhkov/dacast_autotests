require('dotenv').config(); // Load environment variables from .env file
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const host = process.env._HOST; // Retrieve host from .env
    const username = process.env._USERNAME; // Retrieve username from .env
    const password = process.env._PASSWORD; // Retrieve password from .env

    // Go to the login page
    await page.goto(`https://${host}/login`);

  // Fill in the login form
    await page.getByLabel('Email').click();
    await page.getByLabel('Email').fill(username);
    await page.getByLabel('Email').press('Tab');
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();

    //  Adding Video (VOD)
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.locator('#undefined_vod').click();
  

    // Find the hidden input element by its id
    const fileInput = await page.$('#browseButton');

    // Make the element visible
    await page.evaluate((el) => {
      el.style.display = 'block';
    }, fileInput);

    // Upload the file
    await fileInput.setInputFiles('sample_video.MOV');

    // If needed, hide the element again
    await page.evaluate((el) => {
      el.style.display = 'none';
    }, fileInput);

    await page.getByPlaceholder('Search by Title...').click();
    await page.getByPlaceholder('Search by Title...').fill('Sample Video');
    await page.getByRole('button', { name: 'Upload' }).click();

    await page.locator('#scrollbarWrapper').getByText('Videos').click();


    await page.pause();

    // Wait for 5 minutes, so you have time to use the inspector
    await page.waitForTimeout(300000);

  } catch (error) {
    console.error('Error encountered:', error);
  } finally {
    await browser.close();
  }
})();

/* to do
Add error handling
Add validation that the video is uploaded
Add validation that video is playing
Add cleaning (delete videos after test)
*/
