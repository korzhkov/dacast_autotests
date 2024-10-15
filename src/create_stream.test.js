const { test, expect } = require('./utils');

let clipboardy;
let streamName;

test.beforeAll(async () => {
  clipboardy = await import('clipboardy');
});

test('Create stream test', async ({ page }) => {
  // Set a longer timeout for this test as stream creation might take a while
  test.setTimeout(300000);

  await test.step('Create Stream', async () => {
    
    // Start the process of creating a new stream

    
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    await page.waitForTimeout(1000);
    const createLiveStreamButton = await page.$('button:has-text("Create Live Stream")');
    if (createLiveStreamButton) {
      await createLiveStreamButton.click();
    } else {
      console.log('Create Live Stream button not found, clicking Create button instead.');
      await page.getByRole('button', { name: 'Create' }).first().click();
    }
    

    await page.locator('.sc-iLLODe').first().click();
    await page.getByRole('button', { name: 'Choose advanced options' }).nth(1).click();
    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    streamName = `This is a test stream ${formattedDate}`;
    await page.getByPlaceholder('My Live Stream').fill(streamName);
    await page.locator('div:nth-child(3) > .sc-gFAWRd > #dropdownTitle > .sc-klVQfs > .sc-gsFSXq > svg > path:nth-child(2)').click();
    
    // Validate that Adaptive bitrate 1080p Akamai Delivery is present (requirements)
    const akamai1080 = page.getByText('Adaptive Bitrate 1080p Akamai Delivery').first();
    await expect(akamai1080).toBeVisible({ timeout: 1000});
    console.log('Akamai 1080p found, continuing with the test.');

    //await page.locator('[id="streamSlotTypeDropdown_Standard\\ Passthrough\\ Akamai\\ Delivery3"] div').click();
    await page.getByText('Standard Passthrough Akamai Delivery').click();
    // Enable DVR
    //await page.locator('#pageContentContainer div').filter({ hasText: 'Create Live Stream Title Source Region Europe, Middle East & Africa Australia' }).locator('label').nth(1).click();
    await page.locator('xpath=//*[@id="pageContentContainer"]/div[2]/div[2]/div/div[4]/div[1]/div[1]/label').click();
    await page.waitForTimeout(1000);
    await page.locator('.flex > .sc-bBeLUv > div > span:nth-child(2) > svg').click();

    // Check if the Back button is present (based on requirements)
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible({ timeout: 1000 });
    console.log('Back button found, continuing with the test.');
 
    // Find the toggle by exact text "Rewind (DVR)"
    const rewindToggle = page.locator('div:has(> span:text-is("Rewind (DVR)")) > input[type="checkbox"]');

    // Wait for the element to be visible and accessible
    await rewindToggle.waitFor({ state: 'attached', timeout: 5000 });

    // Checking if DVR is enabled
    const isDvrChecked = await rewindToggle.isChecked();

    if (isDvrChecked) {
      console.log('Rewind (DVR) toggle is enabled.');
    } else {
      console.log('Rewind (DVR) toggle is disabled.');
    }
 
        
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
    expect(clipboardContent).toMatch(/^https:\/\/iframe\.dacast\.com\/live\//);
    console.log('Copied share link:', clipboardContent);
 
    // Navigate to the Live Streams page
    await page.getByRole('link', { name: 'Live Streams' }).click();

    // If there are still no stream links, wait again and reload
    await page.waitForTimeout(15000);
    await page.reload();
    console.log('Reloaded the page to get the stream appeared.');
    
    // Delete the stream
    const streamRow = await page.locator(`#videosListTable tr`)
      .filter({ hasText: streamName })
      .first();

    // Approach 1: Hover over the row before clicking
    await streamRow.hover();
    
    // Approach 2: Use force: true to click even if the element is not visible
    await streamRow.locator('div[id^="deleteTooltip"]').click({ force: true });

    // Wait for and click the "Delete forever" button in the confirmation dialog
    await page.getByRole('button', { name: 'Delete forever' }).click();

    await page.waitForTimeout(5000);
    await page.reload();
    console.log('Reloaded the page to validate the stream deletion.');
    // Optional: Verify that the stream has been deleted
    await expect(page.locator(`#videosListTable`).getByText(streamName)).not.toBeVisible();
    console.log('Stream deleted, test completed.');
     
  });
});