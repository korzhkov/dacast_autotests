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

    // Navigate to the Videos page
    await page.locator('#scrollbarWrapper').getByText('Videos').click();

    // Wait for either the "Upload your first Video!" text or the video list to appear
    await Promise.race([
      page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
      page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
    ]);

    // Function to check for existing videos
    async function checkExistingVideos() {
      const noVideosText = await page.locator('text="Upload your first Video!"').count();
      if (noVideosText > 0) {
        console.log('No videos found. Starting to upload videos.');
        return { sample1Exists: false, sample2Exists: false };
      }

      const videoLinks = await page.$$('a[href^="/videos/"]');
      let sample1Exists = false;
      let sample2Exists = false;

      for (const link of videoLinks) {
        const linkText = await link.textContent();
        if (linkText.includes('sample_video.MOV')) sample1Exists = true;
        if (linkText.includes('sample_video2.MOV')) sample2Exists = true;
      }

      return { sample1Exists, sample2Exists };
    }

    // Function to upload a video
    async function uploadVideo(filename) {
      await page.getByRole('button', { name: 'Add +' }).click();
      await page.locator('#undefined_vod').click();

      const fileInput = await page.$('#browseButton');
      if (!fileInput) {
        throw new Error('File input element not found');
      }

      await page.evaluate((el) => { el.style.display = 'block'; }, fileInput);
      await fileInput.setInputFiles(filename);
      await page.evaluate((el) => { el.style.display = 'none'; }, fileInput);

      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill(filename);
      await page.getByRole('button', { name: 'Upload' }).click();

      console.log(`Waiting for ${filename} to be uploaded and transcoded.`);
      await page.waitForTimeout(30000);
      console.log(`${filename} uploaded successfully.`);

      // Navigate back to the Videos page
      await page.locator('#scrollbarWrapper').getByText('Videos').click();
      await Promise.race([
        page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
        page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
      ]);
    }

    // Check for existing videos and upload if needed
    let { sample1Exists, sample2Exists } = await checkExistingVideos();

    if (!sample1Exists) {
      await uploadVideo('sample_video.MOV');
      ({ sample1Exists, sample2Exists } = await checkExistingVideos());
    }

    if (!sample2Exists) {
      await uploadVideo('sample_video2.MOV');
    }

    console.log('Both videos are now available in the list.');

    // Create a playlist

    await page.getByRole('button', { name: 'Add +' }).click();
    await page.getByText('Playlist', { exact: true }).click();

    await page.locator('#playlistModalInput').first().click();

    const unixTime = Math.floor(Date.now() / 1000);
    await page.locator('#playlistModalInput').first().fill(`This is a test playlist ${unixTime}`);
    await page.getByRole('button', { name: 'Create' }).click();


    // Validate playlist creation
    try {
        await page.waitForSelector('text=/This is a test playlist/', { timeout: 5000 });
        console.log('Playlist created successfully.');
    } catch (error) {
        console.error('Error: "This is a test playlist" text did not appear:', error);
    }

    // Add videos to the playlist
    await page.getByText('Contents').click();
    await page.locator('div').filter({ hasText: /^sample_video2\.MOV$/ }).locator('label div').click();
    await page.locator('div').filter({ hasText: /^sample_video\.MOV$/ }).locator('label div').click();
    await page.locator('div:nth-child(4) > div:nth-child(2) > button').first().click();
    await page.getByRole('button', { name: 'Save' }).click();

    // Validate changes have been saved
    try {
        await page.waitForSelector('text="Changes have been saved"', { timeout: 5000 });
        console.log('Changes have been saved successfully.');
    } catch (error) {
        console.error('Error: "Changes have been saved" text did not appear:', error);
    }

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
Add validation that the video is uploaded
Add validation that video is playing
Add cleaning (delete videos after test)
*/
