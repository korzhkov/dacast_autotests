const { test, expect } = require('./utils');
const { uploadVideo } = require('./helpers/fileUploader');

let clipboardy;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create Schedule test', async ({ page, browser }) => {
  console.log('Starting Create Schedule test');
  console.log(`Using browser: ${browser.browserType().name()}`);
  console.log(`Browser version: ${browser.version()}`);
  console.log(`User agent: ${await page.evaluate(() => navigator.userAgent)}`);
  // Set a longer timeout for this test as video upload and Expo creation might take a while
  test.setTimeout(300000);

  await test.step('Navigate to Videos page to check for existing videos', async () => {
    console.log('Navigating to Videos page');
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    
    // Wait for either "Upload your first Video!" text or the list of videos
    await Promise.race([
      page.waitForSelector('text="Upload your first Video!"', { timeout: 60000 }),
      page.waitForSelector('a[href^="/videos/"]', { timeout: 60000 })
    ]);
    console.log('Successfully navigated to Videos page');
  });

  
  
  
  
  await test.step('Check and upload videos if necessary', async () => {
    // Function to check for existing videos
    async function checkExistingVideos() {
      const noVideosText = await page.locator('text="Upload your first Video!"').count();
      if (noVideosText > 0) {
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

    let { sample1Exists, sample2Exists } = await checkExistingVideos();

    // Upload sample_video.MOV if it doesn't exist
    if (!sample1Exists) {
      console.log('Uploading sample_video.MOV');
      await uploadVideo(page, 'sample_video.MOV');
      ({ sample1Exists, sample2Exists } = await checkExistingVideos());
      console.log('sample_video.MOV uploaded successfully');
    }

    // Upload sample_video2.MOV if it doesn't exist (playlist requires at least 2 videos)
    if (!sample2Exists) {
      console.log('Uploading sample_video2.MOV');
      await uploadVideo(page, 'sample_video2.MOV');
      console.log('sample_video2.MOV uploaded successfully');
    }
  });

  // Added this step to validate videos are transcoded because if they are not, then video will not appear in the Expo.
  // In the future it might be a good idea to move it to helpers and use in other tests
  // It will not handle the case when transcoding has failed and changed status from Processing to Fail(?) (don't remember the right status, seen it just once).
  await test.step('Validate videos are transcoded', async () => {
    console.log('Validating video transcoding');
    await page.locator('#scrollbarWrapper').getByText('Videos').click();
    await page.waitForTimeout(5000);
    await test.step('Checking sample_video status', async () => {
      await page.reload();
      const maxAttempts = 5; // Maximum number of attempts to check video status
      let attempts = 0;
      let processingComplete = false;

      while (attempts < maxAttempts && !processingComplete) {
        console.log(`Attempt ${attempts + 1}: Refreshing page and checking video status`);
        
        // Wait for the table to load
        await page.waitForSelector('#videosListTable', { state: 'visible', timeout: 10000 });

        // Find the row containing 'sample_video(2)?\.MOV'
        const row = await page.locator('#videosListTable tr')
          .filter({ hasText: /sample_video(2)?\.MOV/ })
          .first();

        if (await row.count() > 0) {
          const rowText = await row.innerText();
          console.log(`Found row with sample_video: ${rowText}`);

          // Check the video status
          if (rowText.includes('Processing')) {
            console.log('Video is still in Processing status, will refresh again');
            await page.reload();
            await page.waitForTimeout(5000); // Wait for 5 seconds after reload
          } else if (rowText.includes('Online')) {
            console.log('Video processing completed, status is now Online');
            processingComplete = true;
          } else {
            console.log('Video status is unclear, will refresh again');
          }
        } else {
          console.log('sample_video not found in the list, will try again');
        }

        attempts++;

        if (!processingComplete) {
          console.log('Waiting 10 seconds before next refresh');
          await page.waitForTimeout(10000); // Wait for 10 seconds before next attempt
        }
      }
      if (!processingComplete) {
        console.log('Processing did not complete after maximum attempts');
      }
    });
  });

  // Create Schedule
  await test.step('Create Schedule', async () => {
    console.log('Creating new Schedule');
    await page.locator('#scrollbarWrapper').getByText('Schedulers').click();
    
    await page.waitForTimeout(5000);
    // Check if "Create your first Expo!" text exists, if not using another button
    const createFirstScheduleText = await page.getByText('You have no scheduled Live Stream').count();

    if (createFirstScheduleText > 0) {
      console.log('Found "You have no scheduled Live Stream" text');
      await page.getByRole('button', { name: 'Create Channel' }).first().click();
    } else {
      console.log('No "You have no scheduled Live Stream" text found, looking for Create Schedule button');
      await page.getByRole('button', { name: 'Create Schedule' }).first().click();
    }

    // Wait for the modal to appear and click on the "Create Schedule" text
    await page.locator('#pageContentContainer span').filter({ hasText: 'Create Schedule' }).click();

    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    const scheduleName = `This is a test schedule ${formattedDate}`;
    await page.locator('#scheduleForm #playlistModalInput').click();
    await page.locator('#scheduleForm #playlistModalInput').fill(scheduleName);
    
    if (createFirstScheduleText > 0) {
        console.log("Since it's a first schedule, the button should have specific locator");
        await page.getByRole('button', { name: 'Create Schedule' }).first().click();
      } else {
        console.log('Since it\'s not a first schedule, the button should have different locator');
        await page.getByRole('button', { name: 'Create Schedule' }).nth(1).click();
      }
    
    
    

    // await expect(page.locator('text="Schedule successfully created"')).toBeVisible({ timeout: 10000 });
    // console.log(`Schedule "${scheduleName}" created successfully`);

    await page.waitForTimeout(5000);
  });




/*-------------------------------------------------------------------------------------------------

// This is a temp step to skip long steps and jump to the end of the test if necessary

await test.step('Temp step - open expo', async () => {
    await page.getByText('Schedulers').click();
    await page.getByText('This is a test schedule').first().click();
});
-------------------------------------------------------------------------------------------------
*/



  await test.step('Drag and drop first video to Schedule', async () => {
    console.log(`Going to drag and drop first video to Schedule`);
    // Added search for video to minimize chances of the failure when there is a lot of other videos in the list
    await page.getByPlaceholder('Search by Title...').click();
    await page.getByPlaceholder('Search by Title...').fill('screen');
    await page.getByPlaceholder('Search by Title...').press('Enter');
    await page.waitForTimeout(5000); // Added timeout to ensure the search results are visible
    const sourceElement = page.getByText('Screen Recording').first();
    const targetElement = page.locator('.current-time');

    await expect(sourceElement).toBeVisible({timeout: 10000});
    await expect(targetElement).toBeVisible({timeout: 10000});

    // Get bounding boxes
    const sourceBox = await sourceElement.boundingBox();
    const targetBox = await targetElement.boundingBox();

    // Calculate start and end positions
    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height + 50; // 50 pixels below the target

    // Perform the drag and drop
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 }); // Move in steps for smoother animation
    await page.waitForTimeout(500); // Small pause before releasing
    await page.mouse.up();

    // Wait a bit to ensure the drop is processed
    await page.waitForTimeout(5000);
    await expect(page.locator('#calendarGrid').getByText('Screen Recording')).toBeVisible({timeout: 10000});
    console.log('Drag and drop completed');

  });

  await test.step('Edit event', async () => {

//OMG following crazy actions required to get click working on linix server we use. Maybe due to outdated node/playwrite/chrome versions.
// Normally this works: await page.locator('#calendarGrid').getByText('Screen Recording').first().click();
// If you don't understand what's happening here: 1. switching from week to day view; 2. zooming in 3. clicking on the event  
    await page.waitForTimeout(1000);
    await page.locator('.buttons > div:nth-child(3) > div:nth-child(2) > div > svg').click();
    await page.waitForTimeout(1000);
    await page.getByText('day', { exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('#calendarGrid').getByText('Screen Recording').click();
    await page.waitForTimeout(1000);

    console.log('Screen Recording clicked');
    await page.waitForTimeout(10000);
    await page.locator('.flex > .flex > svg:nth-child(2)').first().click();
    console.log('Edit event clicked to adjust event start time');
    await page.waitForTimeout(5000);
    const currentTime = new Date();
    const oneMinuteLater = new Date(currentTime.getTime() + 60000);
    // Format the time one minute from now as HH:MM in 24-hour format
    // All this weird stuff is neccesary because pointer showing in calendar current time is not correct
    const formattedTime = oneMinuteLater.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    await page.locator('#inputstart-time').fill(formattedTime);
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Save' }).click();
    console.log('Event saved');
  });

  await test.step('Test even preview', async () => {

    console.log('Now we should wait 45 seconds before click to Preview button');
    await page.waitForTimeout(45000);
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.waitForTimeout(10000);
    
    await page.getByRole('button', { name: 'Play' }).first().click();
    await page.waitForTimeout(2000);

    const videoElement = await page.$('video');
  
    // Wait for the video to start playing
    await page.waitForFunction(() => {
      const video = document.querySelector('video');
      return video && video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
    }, { timeout: 30000 });
    // Check if the video is playing
    const isPlaying = await videoElement.evaluate((video) => {
      return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
    });
    expect(isPlaying).toBe(true);
    console.log('Video is playing');
    
    await page.waitForTimeout(2000);
    await page.locator('#pageContentContainer div').filter({ hasText: 'Preview Play Video Related' }).getByRole('img').locator('path').nth(1).click();
    await page.waitForTimeout(2000)


await test.step('Analytics test', async () => {
  console.log('Analytics test');
  
    await page.getByRole('link', { name: 'Analytics Analytics' }).click();
    await page.waitForTimeout(5000);
      
    // need to wait, analytics broken, reported to Olivier.

});
  console.log('Test completed');    // Here you can add verification steps to check if the drop was successful
    
  });
});