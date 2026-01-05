const { test, expect } = require('./utils');
const { spawn } = require('child_process');

let clipboardy;
let streamName;
let ffmpegProcess;
let shareLink;
let streamKey;
let streamUrl;

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
    await page.waitForTimeout(1000);
    console.log(`Stream "${streamName}" created`);
  });

  await test.step('Configure DVR settings', async () => {
    await page.locator('#pageContentContainer').getByText('Settings', { exact: true }).click();
    console.log('Clicked on Settings');

    await page.getByTestId('liveRecordingToggleLabel').click();
    console.log('Clicked on Recordings');
    await page.waitForTimeout(2000);

    await page.getByTestId('liveDvrToggleLabel').click();
    console.log('Clicked on DVR');
    
    // Wait for the success notification to appear
    await page.waitForSelector('text=Changes have been saved', { state: 'visible', timeout: 10000 });
    console.log('DVR settings saved successfully');
  });

  await test.step('Get Stream Key', async () => {
    await page.getByRole('button', { name: 'Encoder Setup' }).click();
    await page.waitForTimeout(1000);
    
    // Click to copy stream URL to clipboard
    await page.locator('.sc-izQBue > .sc-gsFSXq > svg > path:nth-child(2)').first().click();
    await page.waitForTimeout(500);
    
    // Get stream URL from clipboard
    streamUrl = await clipboardy.default.read();
    console.log('Stream URL:', streamUrl);

    // Click to copy stream key to clipboard
    await page.locator('.sc-dChVcU > .relative > .sc-izQBue > .sc-gsFSXq > svg > path:nth-child(2)').click();
    await page.waitForTimeout(500);
    
    // Get stream key from clipboard
    streamKey = await clipboardy.default.read();
    console.log('Stream Key:', streamKey);
    
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('Start ffmpeg stream', async () => {
    const fullRtmpUrl = `${streamUrl}/${streamKey}`;
    console.log('Starting ffmpeg stream to:', fullRtmpUrl);

    ffmpegProcess = spawn('ffmpeg', [
      '-re',                          // Read input at native frame rate
      '-stream_loop', '-1',           // Loop indefinitely
      '-i', 'sample_video.MOV',       // Input file
      '-c:v', 'libx264',              // Video codec
      '-preset', 'veryfast',          // Encoding speed preset
      '-b:v', '2500k',                // Video bitrate
      '-maxrate', '2500k',            // Max video bitrate
      '-bufsize', '5000k',            // Buffer size
      '-c:a', 'aac',                  // Audio codec
      '-b:a', '128k',                 // Audio bitrate
      '-ar', '44100',                 // Audio sample rate
      '-f', 'flv',                    // Output format
      fullRtmpUrl                     // RTMP destination
    ], {
      stdio: ['pipe', 'pipe', 'pipe']  // Enable stdin to send 'q' command
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpegProcess.on('error', (error) => {
      console.error('ffmpeg error:', error.message);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`ffmpeg process exited with code ${code}`);
    });

    // Wait for ffmpeg to start streaming
    console.log('Waiting for stream to initialize...');
    await page.waitForTimeout(10000);
  });

  await test.step('Get Share Link', async () => {
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
    shareLink = clipboardContent; // Save for playback verification

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
  });

  await test.step('Verify stream playback', async () => {
    console.log('Opening share link to verify playback:', shareLink);
    await page.goto(shareLink);

    // Wait for player to load
    await page.waitForTimeout(5000);

    // Detect player type (Bitmovin or TheoPlayer)
    const bitmovinDetected = await page.evaluate(() => {
      return !!(
        document.querySelector('.bitmovinplayer-container') ||
        window.bitmovin
      );
    });

    const playerType = bitmovinDetected ? 'Bitmovin' : 'TheoPlayer';
    console.log(`Detected player: ${playerType}`);

    // Clean overlays if present
    await page.evaluate(() => {
      document.querySelectorAll('.dc-dacast-overlay').forEach((el) => el.remove());
    });

    // Click to play
    if (playerType === 'Bitmovin') {
      const playBtn = page.locator('.bitmovinplayer-container button, .dc-play-button').first();
      if (await playBtn.isVisible()) {
        await playBtn.click();
      } else {
        await page.mouse.click(
          page.viewportSize().width / 2,
          page.viewportSize().height / 2
        );
      }
    } else {
      await page.mouse.click(
        page.viewportSize().width / 2,
        page.viewportSize().height / 2
      );
    }

    // Verify playback using HTML5 Video API
    await expect(async () => {
      let isPlaying = false;
      for (const frame of page.frames()) {
        try {
          isPlaying = await frame.evaluate(() => {
            const v = document.querySelector('video');
            return !!(
              v &&
              v.currentTime > 1.5 &&
              !v.paused &&
              v.readyState >= 2
            );
          });
          if (isPlaying) break;
        } catch (e) {}
      }
      expect(isPlaying).toBe(true);
    }).toPass({ timeout: 45000, intervals: [2000] });

    console.log(`Stream playback confirmed for ${playerType}`);
    
    // Keep player open for visual verification
    console.log('Keeping player open for 5 seconds...');
    await page.waitForTimeout(5000);

    // Stop ffmpeg - no longer needed after playback verified
    if (ffmpegProcess) {
      console.log('Stopping ffmpeg process...');
      // Send 'q' command to ffmpeg for graceful shutdown (works on Windows)
      ffmpegProcess.stdin.write('q');
      ffmpegProcess.stdin.end();
      // Wait a bit for ffmpeg to finish
      await page.waitForTimeout(2000);
      ffmpegProcess = null;
    }
  });

  await test.step('Check and remove DVR stream if present', async () => {
    // Navigate to Live Streams page
    await page.goto('https://app.dacast.com/livestreams');
    await page.waitForTimeout(2000);
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