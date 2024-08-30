require('dotenv').config(); // Load environment variables from .env file
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
    await page.getByLabel('Email').click();
    await page.getByLabel('Email').fill(username);
    await page.getByLabel('Email').press('Tab');
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();

    console.log('Login form submitted successfully.');

    //  Adding Video (VOD)
    await page.getByRole('button', { name: 'Add +' }).click();
    await page.locator('#undefined_vod').click();
  

    // Find the hidden input element by its id
    const fileInput = await page.$('#browseButton');
    if (!fileInput) {
      throw new Error('File input element not found');
    }

    // Make the element visible
    await page.evaluate((el) => {
      el.style.display = 'block';
    }, fileInput);

    // Upload the file
    await fileInput.setInputFiles('sample_video.MOV');

    // Hide the element again
    await page.evaluate((el) => {
      el.style.display = 'none';
    }, fileInput);

    await page.getByPlaceholder('Search by Title...').click();
    await page.getByPlaceholder('Search by Title...').fill('Sample Video');
    await page.getByRole('button', { name: 'Upload' }).click();

    console.log('Waiting for the video to be uploaded and transcoded.');
    // Wait for 30 seconds to make sure the video is uploaded and transcoded
    await page.waitForTimeout(30000);
    console.log('Video uploaded successfully.');
    // Navigate to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();

    // Wait for the videos to load
    await page.waitForSelector('a[href^="/videos/"]');

    // Find all video links and click the first one that matches the name
    const videoLinks = await page.$$('a[href^="/videos/"]');
    let videoClicked = false;
    for (const link of videoLinks) {
      const linkText = await link.textContent();
      if (linkText.includes('sample_video.MOV')) {
        await link.click();
        videoClicked = true;
        break;
      }
    }

    if (!videoClicked) {
      throw new Error('No matching video found');
    }

    // Changing description of the video
    await page.locator('textarea[type="textarea"]').click();
    await page.locator('textarea[type="textarea"]').fill('This is a test video');
    await page.locator('#pageContentContainer div').filter({ hasText: 'Title Date Status Features' }).nth(2).click();

    // Wait for the "Changes have been saved" text to appear
    try {
      await page.waitForSelector('text="Changes have been saved"', { timeout: 5000 });
      console.log('Changes have been saved successfully.');
    } catch (error) {
      console.error('Error: "Changes have been saved" text did not appear:', error);
    }

    await page.waitForTimeout(5000);
    console.log('Video description added successfully.');
    // Navigate back to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    console.log('Navigated back to the Videos page successfully.');
    console.log('Test completed successfully.');
    
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
Add validation that the video is uploaded
Add validation that video is playing
Add cleaning (delete videos after test)
*/
