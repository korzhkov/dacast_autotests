const { test, expect } = require('./utils');

let clipboardy;
let streamName;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create stream test', async ({ page }) => {
  // Set a longer timeout for this test as stream creation might take a while
  test.setTimeout(300000);

    await test.step('Check and remove test DVR stream if present', async () => {
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    await page.waitForTimeout(1000);
    const dvrCell = await page.getByRole('cell', { name: 'This is a test DVR stream' });
    const dvrCellCount = await dvrCell.count();

    if (dvrCellCount > 0) {
      console.log('DVR streams found, attempting to delete them.');

      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('\"This is a test DVR stream\"');
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(1000);
      await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Bulk Actions' }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('list').getByText('Delete').click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Delete' }).click();

      
      console.log('DVR cell deleted.');
      await page.waitForTimeout(10000); // Looks like DVR limits are not removed immediately, let's give it some wait  
    } else {
      console.log('DVR cell not found, no action needed.');
    }
  });
    
  await test.step('Create Stream', async () => {
    
    // Start the process of creating a new stream

    await page.waitForTimeout(1000);
    const createLiveStreamButton = await page.$('button:has-text("Create Live Stream")');
    if (createLiveStreamButton) {
      await createLiveStreamButton.click();
    } else {
      console.log('Create Live Stream button not found, clicking Create button instead.');
      await page.getByRole('button', { name: 'Create' }).first().click();
    }
    
    await page.getByText('Standard Passthrough Channel').first().click();
    await page.getByRole('button', { name: 'Choose advanced options' }).nth(1).click();
    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    streamName = `This is a test DVR stream ${formattedDate}`;
    await page.getByPlaceholder('My Live Stream').fill(streamName);
    await page.locator('div:nth-child(3) > .sc-gFAWRd > #dropdownTitle > .sc-klVQfs > .sc-gsFSXq > svg > path:nth-child(2)').click();
    
    // Validate that Adaptive bitrate 1080p Akamai Delivery is present (requirements)
    const akamai1080 = page.locator('[id="streamSlotTypeDropdown_Adaptive\\ Bitrate\\ 1080p\\ Akamai\\ Delivery0"] div');
    await expect(akamai1080).toBeVisible({ timeout: 1000});
    console.log('Akamai 1080p found, continuing with the test.');

    await page.getByText('Standard Passthrough Akamai Delivery').first().click();
    
    // Check if the Back button is present (based on requirements)
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible({ timeout: 1000 });
    console.log('Back button found, continuing with the test.');
        
    const createButton = page.locator('div.sc-iMTnTL:has(button:has-text("Create")):has(button:has-text("Back")) button:has-text("Create")');
    await createButton.click();

    
    
  // Find the toggle by exact text "Live Stream Online"
    const streamOnlineToggle = page.locator('div:has(> span:text-is("Live Stream Online")) > input[type="checkbox"]');

    // Checking if Live Stream Online is enabled
    const isStreamOnlineChecked = await streamOnlineToggle.isChecked();

    if (isStreamOnlineChecked) {
      console.log('Live Stream Online toggle is enabled.');
    } else {
      console.log('Live Stream Online toggle is disabled.');
    }
    // Copy the share link
    await page.getByRole('button', { name: 'Copy Share Link' }).click();
    
    // Wait for the clipboard content to be updated
    await page.waitForTimeout(1000);
    
    // Get the clipboard content
    const clipboardContent = await clipboardy.default.read();

    // Check if the copied link starts with 'https://iframe.dacast.com/live/'
    const env = process.env.WORKENV || 'prod';
    
    if (env === 'prod') {
      expect(clipboardContent).toMatch(/^https:\/\/iframe\.dacast\.com\/live\//);
    } else if (env === 'stage') {
      expect(clipboardContent).toMatch(/^https:\/\/iframe-dev\.dacast\.com\/live\//);
    } else if (env === 'dev') {
      expect(clipboardContent).toMatch(/^https:\/\/iframe-test\.dacast\.com\/live\//);
    }
    
    console.log('Copied share link:', clipboardContent);

    await page.pause();
    
    await page.locator('#pageContentContainer').getByText('Settings', { exact: true }).click();
    console.log('Clicked on Settings');
    await page.locator('.mb2 > div > .sc-YysOf').first().click();
    console.log('Clicked on Recordings');
    await page.waitForTimeout(2000);
    await page.locator('.sc-bhqpjJ > .mb2 > div > .sc-YysOf').click();
    console.log('Clicked on DVR');
    await expect(page.getByText('Changes have been saved')).toBeVisible({ timeout: 10000 });
    console.log('DVR settings changed');
 
    // Navigate to the Live Streams page
    await page.getByRole('link', { name: 'Live Streams' }).click();

    // If there are still no stream links, wait again and reload
    await page.waitForTimeout(15000);
    console.log('Reloaded the page to get the stream appeared.');
    await page.reload();
  });


  

  await test.step('Check and remove DVR stream if present', async () => {

    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    await page.waitForTimeout(1000);
    const dvrCell = await page.getByRole('cell', { name: 'This is a test DVR stream' });
    const dvrCellCount = await dvrCell.count();

    
    if (dvrCellCount > 0) {
      console.log('DVR streams found, attempting to delete them.');

      
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('\"This is a test DVR stream\"');
      await page.getByPlaceholder('Search by Title...').press('Enter');

      // Wait for the search results to load
      await page.waitForTimeout(2000);

      // Primary selectors: Search by content and structure
      const recordingTooltip = page.locator('div.sc-kAyceB:has(span[id^="recordingTooltip"])');
      const rewindTooltip = page.locator('div.sc-kAyceB:has(div[id^="rewindTooltip"])');

      // Alternative selectors: Search by text content
      const recordingByText = page.locator('div:has-text("Recording")');
      const rewindByText = page.locator('div:has-text("DVR")');

      // Wait for at least one element of each type to be present
      try {
        await recordingTooltip.first().waitFor({ state: 'attached', timeout: 10000 });
        await rewindTooltip.first().waitFor({ state: 'attached', timeout: 10000 });
      } catch (error) {
        console.log('Primary selectors failed, trying alternative selectors...');
      }

      const recordingTooltipCount = await recordingTooltip.count();
      const rewindTooltipCount = await rewindTooltip.count();

      console.log(`Primary method: Found ${recordingTooltipCount} recording tooltip elements`);
      console.log(`Primary method: Found ${rewindTooltipCount} rewind tooltip elements`);

      // If primary method failed, try alternative method
      if (recordingTooltipCount === 0 || rewindTooltipCount === 0) {
        console.log('Trying alternative selectors...');
        
        const recordingByTextCount = await recordingByText.count();
        const rewindByTextCount = await rewindByText.count();
        
        console.log(`Alternative method: Found ${recordingByTextCount} recording elements by text`);
        console.log(`Alternative method: Found ${rewindByTextCount} rewind elements by text`);
        
        if (recordingByTextCount > 0 && rewindByTextCount > 0) {
          console.log('Elements found using alternative method');
        } else {
          console.error('Neither primary nor alternative method found the required elements');
          test.fail();
        }
      } else {
        console.log('Elements found using primary method');
      }

            
      await page.waitForTimeout(1000);  
      await page.getByRole('row', { name: 'Title Date Status Features' }).locator('label div').click();
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Bulk Actions' }).click();
      await page.waitForTimeout(2000);
      await page.getByRole('list').getByText('Delete').click();
      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(2000);
      console.log('DVR cell deleted.');

      
    } else {
      console.error('DVR cell not found - this is an error condition');
      test.fail();
    }
  });
});