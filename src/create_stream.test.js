/**
 * Create Stream Test
 * 
 * This test validates the complete livestream workflow:
 * 1. Creates a new stream channel with DVR settings
 * 2. Starts streaming via ffmpeg
 * 3. Verifies playback works correctly
 * 4. Cleans up test data
 * 
 * Prerequisites:
 * - ffmpeg must be installed and available in PATH
 * - sample_video.MOV must exist in the project root
 */

const { test, expect } = require('./utils');
const { spawn } = require('child_process');

// Module-level variables shared across test steps
let clipboardy;
let streamName;      // Unique name for the test stream
let ffmpegProcess;   // Reference to ffmpeg child process
let shareLink;       // Public URL for stream playback
let streamKey;       // RTMP stream key from Encoder Setup
let streamUrl;       // RTMP server URL from Encoder Setup

test.beforeAll(async () => {
  // Dynamic import for clipboardy (ESM module)
  clipboardy = await import('clipboardy');
});

test('Create stream test', async ({ page }) => {
  // Extended timeout for stream creation and playback verification
  test.setTimeout(300000); // 5 minutes

  // ============================================================
  // STEP 1: Cleanup - Remove any existing test streams
  // ============================================================
  await test.step('Check and remove test DVR stream if present', async () => {
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    await page.waitForTimeout(1000);
    
    const dvrCell = await page.getByRole('cell', { name: 'This is a test DVR stream' });
    const dvrCellCount = await dvrCell.count();

    if (dvrCellCount > 0) {
      console.log('DVR streams found, attempting to delete them.');

      // Search for test streams and delete via bulk actions
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('\"This is a test DVR stream\"');
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(1000);
      
      // Select all and delete
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

  // ============================================================
  // STEP 2: Create new stream channel
  // ============================================================
  await test.step('Create Stream', async () => {
    await page.waitForTimeout(1000);
    
    // Handle different UI states (new account vs existing streams)
    const createLiveStreamButton = await page.$('button:has-text("Create Live Stream")');
    if (createLiveStreamButton) {
      await createLiveStreamButton.click();
    } else {
      console.log('Create Live Stream button not found, clicking Create button instead.');
      await page.getByRole('button', { name: 'Create' }).first().click();
    }
    
    // Select Standard Passthrough Channel type
    await page.getByText('Standard Passthrough Channel').first().click();
    await page.getByRole('button', { name: 'Choose advanced options' }).nth(1).click();
    
    // Generate unique stream name with timestamp
    const currentDate = new Date();
    const formattedDate = `${currentDate.toISOString().slice(0, 19).replace('T', ' ')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;
    streamName = `This is a test DVR stream ${formattedDate}`;
    await page.getByPlaceholder('My Live Stream').fill(streamName);
    
    // Open stream type dropdown
    await page.locator('div:nth-child(3) > .sc-gFAWRd > #dropdownTitle > .sc-klVQfs > .sc-gsFSXq > svg > path:nth-child(2)').click();
    
    // Validate Akamai 1080p option is available (business requirement)
    const akamai1080 = page.locator('[id="streamSlotTypeDropdown_Adaptive\\ Bitrate\\ 1080p\\ Akamai\\ Delivery0"] div');
    await expect(akamai1080).toBeVisible({ timeout: 1000});
    console.log('Akamai 1080p found, continuing with the test.');

    // Select Standard Passthrough delivery
    await page.getByText('Standard Passthrough Akamai Delivery').first().click();
    
    // Validate Back button is present (UX requirement)
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible({ timeout: 1000 });
    console.log('Back button found, continuing with the test.');
    
    // Click Create button (specific selector to avoid conflicts)
    const createButton = page.locator('div.sc-iMTnTL:has(button:has-text("Create")):has(button:has-text("Back")) button:has-text("Create")');
    await createButton.click();
    await page.waitForTimeout(1000);
    console.log(`Stream "${streamName}" created`);
  });

  // ============================================================
  // STEP 3: Enable DVR settings (Recording + Rewind)
  // ============================================================
  await test.step('Configure DVR settings', async () => {
    await page.locator('#pageContentContainer').getByText('Settings', { exact: true }).click();
    console.log('Clicked on Settings');

    // Enable Recording first (required for DVR)
    await page.getByTestId('liveRecordingToggleLabel').click();
    console.log('Clicked on Recordings');
    await page.waitForTimeout(2000);

    // Enable DVR (Rewind functionality)
    await page.getByTestId('liveDvrToggleLabel').click();
    console.log('Clicked on DVR');
    
    // Wait for the success notification to appear
    await page.waitForSelector('text=Changes have been saved', { state: 'visible', timeout: 10000 });
    console.log('DVR settings saved successfully');
  });

  // ============================================================
  // STEP 4: Get RTMP credentials from Encoder Setup
  // ============================================================
  await test.step('Get Stream Key', async () => {
    await page.getByRole('button', { name: 'Encoder Setup' }).click();
    await page.waitForTimeout(1000);
    
    // Copy Stream URL (RTMP server address)
    await page.locator('.sc-izQBue > .sc-gsFSXq > svg > path:nth-child(2)').first().click();
    await page.waitForTimeout(500);
    
    // Get stream URL from clipboard
    streamUrl = await clipboardy.default.read();
    console.log('Stream URL:', streamUrl);

    // Copy Stream Key (authentication token)
    await page.locator('.sc-dChVcU > .relative > .sc-izQBue > .sc-gsFSXq > svg > path:nth-child(2)').click();
    await page.waitForTimeout(500);
    
    // Get stream key from clipboard
    streamKey = await clipboardy.default.read();
    console.log('Stream Key:', streamKey);
    
    await page.getByRole('button', { name: 'Close' }).click();
  });

  // ============================================================
  // STEP 5: Start ffmpeg streaming process
  // ============================================================
  await test.step('Start ffmpeg stream', async () => {
    const fullRtmpUrl = `${streamUrl}/${streamKey}`;
    console.log('Starting ffmpeg stream to:', fullRtmpUrl);

    // Launch ffmpeg as background process
    ffmpegProcess = spawn('ffmpeg', [
      '-re',                          // Read input at native frame rate (real-time)
      '-stream_loop', '-1',           // Loop video indefinitely
      '-i', 'sample_video.MOV',       // Input file
      '-c:v', 'libx264',              // H.264 video codec
      '-preset', 'veryfast',          // Fast encoding (less CPU)
      '-b:v', '2500k',                // Video bitrate
      '-maxrate', '2500k',            // Max bitrate cap
      '-bufsize', '5000k',            // Buffer size (2x bitrate)
      '-c:a', 'aac',                  // AAC audio codec
      '-b:a', '128k',                 // Audio bitrate
      '-ar', '44100',                 // Audio sample rate
      '-f', 'flv',                    // FLV output format (required for RTMP)
      fullRtmpUrl
    ], {
      stdio: ['pipe', 'pipe', 'pipe']  // Enable stdin for graceful shutdown
    });

    // Log ffmpeg output for debugging
    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpegProcess.on('error', (error) => {
      console.error('ffmpeg error:', error.message);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`ffmpeg process exited with code ${code}`);
    });

    // Wait for stream to initialize on the server
    console.log('Waiting for stream to initialize...');
    await page.waitForTimeout(10000);
  });

  // ============================================================
  // STEP 6: Get and validate Share Link
  // ============================================================
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

    // Validate share link format based on environment
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

  // ============================================================
  // STEP 7: Verify stream playback in browser
  // ============================================================
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

    // Click to start playback (different approach per player)
    if (playerType === 'Bitmovin') {
      const playBtn = page.locator('.bitmovinplayer-container button, .dc-play-button').first();
      if (await playBtn.isVisible()) {
        await playBtn.click();
      } else {
        // Fallback: click center of viewport
        await page.mouse.click(
          page.viewportSize().width / 2,
          page.viewportSize().height / 2
        );
      }
    } else {
      // TheoPlayer: click center of viewport
      await page.mouse.click(
        page.viewportSize().width / 2,
        page.viewportSize().height / 2
      );
    }

    // Verify video is actually playing using HTML5 Video API
    // Retry with polling because stream might need time to buffer
    await expect(async () => {
      let isPlaying = false;
      // Check all frames (video might be in iframe)
      for (const frame of page.frames()) {
        try {
          isPlaying = await frame.evaluate(() => {
            const v = document.querySelector('video');
            return !!(
              v &&
              v.currentTime > 1.5 &&   // Video has progressed
              !v.paused &&              // Not paused
              v.readyState >= 2         // Has enough data
            );
          });
          if (isPlaying) break;
        } catch (e) {
          // Frame might not be accessible, continue to next
        }
      }
      expect(isPlaying).toBe(true);
    }).toPass({ timeout: 45000, intervals: [2000] });

    console.log(`Stream playback confirmed for ${playerType}`);
    
    // Keep player open briefly for visual verification
    console.log('Keeping player open for 5 seconds...');
    await page.waitForTimeout(5000);

    // Stop ffmpeg gracefully
    if (ffmpegProcess) {
      console.log('Stopping ffmpeg process...');
      // Send 'q' command - ffmpeg's standard quit signal (works on all platforms)
      ffmpegProcess.stdin.write('q');
      ffmpegProcess.stdin.end();
      // Wait a bit for ffmpeg to finish
      await page.waitForTimeout(2000);
      ffmpegProcess = null;
    }
  });

  // ============================================================
  // STEP 8: Cleanup - Remove test stream
  // ============================================================
  await test.step('Check and remove DVR stream if present', async () => {
    await page.goto('https://app.dacast.com/livestreams');
    await page.waitForTimeout(2000);
    await page.locator('#scrollbarWrapper').getByText('Live Streams').click();
    await page.waitForTimeout(1000);
    
    const dvrCell = await page.getByRole('cell', { name: 'This is a test DVR stream' });
    const dvrCellCount = await dvrCell.count();

    if (dvrCellCount > 0) {
      console.log('DVR streams found, attempting to delete them.');

      // Search for test streams
      await page.getByPlaceholder('Search by Title...').click();
      await page.getByPlaceholder('Search by Title...').fill('\"This is a test DVR stream\"');
      await page.getByPlaceholder('Search by Title...').press('Enter');
      await page.waitForTimeout(2000);

      // Verify DVR features are visible (Recording and Rewind icons)
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

      // Fallback to text-based selectors
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

      // Select all and delete via bulk actions
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
