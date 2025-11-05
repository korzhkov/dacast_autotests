const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs'); // Import fs module for file check
const execAsync = promisify(exec);

// Get environment from command line or default to prod
const env = process.env.WORKENV || 'prod';
const hostAPI =
  env === 'prod'
    ? process.env._HOST_API
    : env === 'stage'
    ? process.env._HOST_API_STAGE
    : process.env._HOST_API_DEV;
const apiKey =
  env === 'prod'
    ? process.env._API_KEY
    : env === 'stage'
    ? process.env._API_KEY_STAGE
    : process.env.hasOwnProperty('_API_KEY_DEV')
    ? process.env._API_KEY_DEV
    : process.env._API_KEY; // Fallback if _API_KEY_DEV is not set

// Variables to store created resources
let createdVodId = null;
let createdPlaylistId = null;

// Determine platform for curl command escaping
const isWindows = process.platform === 'win32';

// --- Helper functions for Polling ---

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute curl command and process response.
 * @param {string} rawCurlCmd The raw curl command string.
 * @param {string} api_key The API key to mask in logs.
 * @param {string} env The environment name for logging.
 * @param {object} options Additional options.
 * @returns {Promise<{httpStatus: number, responseBody: string, response: object}>}
 */
const executeCurlRequest = async (rawCurlCmd, api_key, env, options = {}) => {
  let finalCmd = rawCurlCmd;
  const { skipLogging } = options;

  // --- START: Shell Fixes (Ensuring URL and & are handled) ---
  if (isWindows) {
    // Wrap URL in double quotes on Windows
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = finalCmd.match(urlRegex);

    if (urlMatch && urlMatch[0].includes('?')) {
      const url = urlMatch[0];
      if (!url.startsWith('"') && !url.endsWith('"')) {
        finalCmd = finalCmd.replace(url, `"${url}"`);
      }
    }

    // Escape '&' characters if not part of a quoted string
    finalCmd = finalCmd.replace(/&/g, '^&');
  }
  // --- END: Shell Fixes ---

  // Output command to console (masking API key for security)
  const maskedCmd = finalCmd.replace(api_key, 'XXXXX');
  if (!skipLogging) {
    console.log('Executing curl command:', maskedCmd);
    console.log(`Executing request for environment: ${env}`);
  }

  try {
    const { stdout, stderr } = await execAsync(finalCmd);

    if (stderr && !skipLogging) {
      console.error('Curl stderr:', stderr);
    }

    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find((line) => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines
      .filter((line) => !line.startsWith('HTTPSTATUS:'))
      .join('\n');

    if (!skipLogging) {
      console.log(`HTTP Status Code: ${httpStatus}`);
    }

    let response = null;
    try {
      if (responseBody.trim().length > 0) {
        response = JSON.parse(responseBody);
      }
    } catch (e) {
      // Non-JSON response (e.g., 204 No Content) is acceptable
      if (!skipLogging && httpStatus >= 400) {
        console.error(
          'Raw response body (Non-JSON or Error):',
          responseBody.trim(),
        );
      }
    }

    // Log error body if status is 500 or if error status code is returned
    if (!skipLogging && httpStatus >= 400 && responseBody.trim().length > 0) {
      console.error(`--- ${httpStatus} ERROR RESPONSE BODY ---`);
      console.error(responseBody.trim());
      console.error('---------------------------------');
    }

    return { httpStatus, responseBody, response };
  } catch (error) {
    if (!skipLogging) {
      console.error('Error executing curl command:', error.message);
    }
    throw error;
  }
};

/**
 * Polls the API using a GET request until the resource becomes available (HTTP 200).
 * @param {string} id Playlist ID or VOD ID to check.
 * @param {string} resourceType 'playlists' or 'vod'.
 * @param {number} maxAttempts Maximum number of attempts. (Default: 30)
 * @param {number} delayMs Delay between attempts in milliseconds. (Default: 10000ms)
 */
const pollForResourceAvailability = async (
  id,
  resourceType,
  maxAttempts = 30,
  delayMs = 10000,
) => {
  // Use a reliable method for the base URL construction
  const apiUrlBase = `https://${hostAPI}/v2/${resourceType}/${id}`;
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "${apiUrlBase}" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const totalWaitTime = (maxAttempts * delayMs) / 1000;
    console.log(
      `Polling for ${resourceType} ${id} availability (Attempt ${attempt}/${maxAttempts}). Max wait time: ${totalWaitTime} seconds.`,
    );

    try {
      const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env, {
        skipLogging: true,
      });

      if (httpStatus === 200) {
        console.log(`${resourceType} ${id} is available (Status 200).`);
        return true;
      } else if (httpStatus === 404) {
        console.log(
          `${resourceType} ${id} not found yet (Status 404). Waiting...`,
        );
      } else {
        console.warn(
          `Polling received unexpected status ${httpStatus}. Waiting...`,
        );
      }
    } catch (e) {
      console.error(`Polling error: ${e.message}. Waiting...`);
    }

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(
    `${resourceType} ${id} was not available after ${maxAttempts} attempts (${
      (maxAttempts * delayMs) / 1000
    } seconds timeout).`,
  );
};

/**
 * Polls the VOD list via GET /v2/vod to find the created VOD by its title
 * and returns the correct VOD ID.
 * @param {string} title The title to search for.
 * @param {number} maxAttempts Maximum number of attempts. (Default: 40)
 * @param {number} delayMs Delay between attempts in milliseconds. (Default: 10000ms)
 * @returns {Promise<string>} The ID of the found VOD.
 */
const searchForVodIdByTitle = async (
  title,
  maxAttempts = 40,
  delayMs = 10000,
) => {
  const urlSeparator = isWindows ? '^/^/' : '//';
  // CRITICAL: Search URL uses title parameter
  const apiUrlBase = `https://${hostAPI}/v2/vod?per_page=15&page=1&title=${encodeURIComponent(
    title,
  )}`;
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "${apiUrlBase}" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const totalWaitTime = (maxAttempts * delayMs) / 1000;
    console.log(
      `Searching for VOD with title "${title}" (Attempt ${attempt}/${maxAttempts}). Max wait time: ${totalWaitTime} seconds.`,
    );

    try {
      const { httpStatus, response } = await executeCurlRequest(
        curlCmd,
        apiKey,
        env,
        { skipLogging: true },
      );

      if (httpStatus === 200 && response && Array.isArray(response.data)) {
        // Filter the list to find the VOD with the exact title
        const foundVod = response.data.find((vod) => vod.title === title);

        if (foundVod && foundVod.id) {
          console.log(`VOD found in list with ID: ${foundVod.id}`);
          return foundVod.id;
        } else {
          console.log(
            `VOD with title "${title}" not yet found in list. Waiting...`,
          );
        }
      } else if (httpStatus !== 200) {
        console.warn(
          `Search polling received status ${httpStatus}. Waiting...`,
        );
      }
    } catch (e) {
      console.error(`Search polling error: ${e.message}. Waiting...`);
    }

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(
    `VOD with title "${title}" was not found after ${maxAttempts} attempts. Search query used: ${apiUrlBase}`,
  );
};

/**
 * Polls the playlist resource until the specified VOD ID is found in the vod_ids array.
 * @param {string} playlistId The playlist ID to check.
 * @param {string} vodId The VOD ID expected in the playlist.
 * @param {number} maxAttempts Maximum number of attempts. (Default: 7, reduced from 20)
 * @param {number} delayMs Delay between attempts in milliseconds. (Default: 10000ms)
 */
const pollForVodInPlaylist = async (
  playlistId,
  vodId,
  maxAttempts = 7, // Reduced from 20 to decrease overall wait time (200s -> 70s)
  delayMs = 10000,
) => {
  const urlSeparator = isWindows ? '^/^/' : '//';
  const apiUrlBase = `https://${hostAPI}/v2/playlists/${playlistId}`;
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "${apiUrlBase}" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const totalWaitTime = (maxAttempts * delayMs) / 1000;
    console.log(
      `Polling playlist ${playlistId} for VOD ${vodId} inclusion (Attempt ${attempt}/${maxAttempts}). Max wait time: ${totalWaitTime} seconds.`,
    );

    try {
      const { httpStatus, response } = await executeCurlRequest(
        curlCmd,
        apiKey,
        env,
        { skipLogging: true },
      );

      if (
        httpStatus === 200 &&
        response &&
        Array.isArray(response.vod_ids) &&
        response.vod_ids.includes(vodId)
      ) {
        console.log(
          `VOD ${vodId} successfully found in playlist ${playlistId}.`,
        );
        return true;
      } else if (httpStatus === 200) {
        // Log the current state of vod_ids for debugging
        const vodIdsLog = response.vod_ids
          ? Array.isArray(response.vod_ids)
            ? response.vod_ids.join(', ')
            : 'Field not an array'
          : 'Field missing/empty';
        console.log(
          `VOD not yet included. Current vod_ids: ${vodIdsLog}. Waiting...`,
        );
      } else if (httpStatus === 404) {
        console.log(
          `Playlist ${playlistId} not found during polling. Waiting...`,
        );
      } else {
        console.warn(
          `Polling received unexpected status ${httpStatus}. Waiting...`,
        );
      }
    } catch (e) {
      console.error(`Polling error: ${e.message}. Waiting...`);
    }

    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }

  throw new Error(
    `VOD ${vodId} was not successfully included in playlist ${playlistId} after ${maxAttempts} attempts.`,
  );
};

// --- API Tests ---

/**
 * SETUP: Create VOD Resource for Playlist Test (Curl Upload Flow)
 * 1. POST /v2/vod with upload_type: 'curl' and searchable title.
 * 2. PUT file to presigned URL.
 * 3. GET /v2/vod?title=... to find the real VOD ID.
 */
test('SETUP: Create VOD Resource for Playlist Test (Curl Upload Flow)', async () => {
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Define file names and paths
  const vodFileName = 'sample_video.MOV';
  // CRITICAL: Resolve the absolute path to ensure curl finds the file
  const vodFilePath = path.resolve(process.cwd(), vodFileName);
  // CRITICAL CHANGE: Use the file name as the title, as the search relies on it
  const vodTitle = vodFileName;
  const vodSource = vodFileName;

  // NEW: Check if file exists before proceeding
  if (!fs.existsSync(vodFilePath)) {
    throw new Error(
      `CRITICAL: The required VOD file "${vodFileName}" was not found at the absolute path: ${vodFilePath}. Please ensure it exists in your project root.`,
    );
  } else {
    console.log(`File check successful: Found VOD file at ${vodFilePath}`);
  }

  const urlSeparator = isWindows ? '^/^/' : '//';

  // 1. INIT VOD: Use 'curl' upload type with a searchable title
  const initJsonBody = JSON.stringify({
    title: vodTitle, // Use filename as title for search
    source: vodSource,
    upload_type: 'curl',
  });

  // FIX: Unified JSON escaping for POST/PUT requests
  let dataArgumentInit;
  const escapedInitJsonBody = initJsonBody.replace(/"/g, '\\"');
  dataArgumentInit = `"${escapedInitJsonBody}"`;

  // Use /v2/vod endpoint
  const initCurlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/vod -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d ${dataArgumentInit}`;

  console.log(
    '--- Step 1: Initialize VOD (POST /v2/vod with upload_type: "curl" and searchable title) ---',
  );
  const { httpStatus: initStatus, response: initResponse } =
    await executeCurlRequest(initCurlCmd, apiKey, env);

  // Expect 200 OK
  expect(initStatus).toBe(200);

  let uploadCurlCmd = null;
  if (initResponse && initResponse.id) {
    // CRITICAL: Discard the initial ID as it is not linked to the final resource.
    console.log(
      `Initial VOD ID (DISCARDED): ${initResponse.id}. Will search for the real ID after upload.`,
    );
  }
  if (initResponse && initResponse['curl-command']) {
    uploadCurlCmd = initResponse['curl-command'];
    console.log('Received S3 curl-command for upload.');
  }

  expect(uploadCurlCmd).toBeDefined();

  // 2. UPLOAD VOD: Execute PUT to the presigned URL (File Upload)
  if (uploadCurlCmd) {
    let finalUploadCmd = uploadCurlCmd;

    // 2.1. Ensure -k flag is present (ignore certificate issues)
    finalUploadCmd = finalUploadCmd.includes(' -k ')
      ? finalUploadCmd
      : finalUploadCmd.replace('curl', 'curl -k');

    // 2.2. Add -f flag (fail silently) for stability
    finalUploadCmd = finalUploadCmd.includes(' -f ')
      ? finalUploadCmd
      : finalUploadCmd.replace('curl -k', 'curl -k -f');

    // 2.3. Replace file name/placeholder with the required ABSOLUTE PATH in quotes
    const sourceNameInCommand = vodSource;

    // Regex to find the "-T <filename_or_path>" part of the command
    const escapedSourceName = sourceNameInCommand.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const fileReferenceRegex = new RegExp(
      `(-T\\s+)(@?\\/path\\/to\\/file|@?${escapedSourceName})`,
      'i',
    );

    // CRITICAL FIX: Replace the path placeholder with the ABSOLUTE PATH enclosed in quotes,
    finalUploadCmd = finalUploadCmd.replace(
      fileReferenceRegex,
      `$1"${vodFilePath}"`,
    );

    // ADDITIONAL CHECK: If the API response did not include the Content-Type header, add it manually
    if (!finalUploadCmd.includes('Content-Type')) {
      // Add header for MOV (a frequent omission causing S3 errors)
      finalUploadCmd = finalUploadCmd.replace(
        '-H "X-Api-Key:',
        '-H "Content-Type: video/quicktime" -H "X-Api-Key:',
      );
    }

    console.log(
      `--- Step 2: Execute file upload (${vodFileName}) via S3 presigned URL ---`,
    );
    const maskedUploadCmd = finalUploadCmd.replace(apiKey, 'XXXXX');
    console.log('Executing S3 Upload:', maskedUploadCmd);

    try {
      // Execute the file upload command.
      await execAsync(finalUploadCmd);
      console.log(
        `VOD file upload command executed successfully (HTTP 200 assumed).`,
      );
    } catch (e) {
      // CRITICAL FIX: Log the detailed error message received from the shell
      console.error(
        'S3 PUT Upload failed. This often indicates a missing file, a file permission error, a broken S3 signature, or Content-Type mismatch.',
      );
      console.error('Raw system error message from exec:', e.message); // <-- Log raw system error
      console.error(
        `Error details: ${e.message}. The final curl command executed was: ${maskedUploadCmd}`,
      );
      // Updated error message for the user
      throw new Error(
        `S3 VOD Upload failed during execution. CRITICAL: Check the console log for the "Raw system error message" to diagnose the exact issue (file not found, permission denied, or S3 signature error). File path used: ${vodFilePath}`,
      );
    }
  } else {
    throw new Error('Upload curl command not found in API response.');
  }

  // 3. SEARCH FOR VOD ID: Find the real VOD resource by its title
  console.log('--- Step 3: Polling VOD list to find final VOD ID by title ---');
  // Use a long timeout here as processing starts after upload
  createdVodId = await searchForVodIdByTitle(vodTitle);

  if (!createdVodId) {
    throw new Error(
      `Failed to find the final VOD ID after successful upload and searching by title: ${vodTitle}`,
    );
  }
  console.log(`VOD found and final VOD ID set to: ${createdVodId}`);
});

// --- START: Playlist Tests (These rely on createdVodId being ready) ---

/**
 * TEST: Create playlist via API
 */
test('Create playlist via API', async () => {
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  if (!createdVodId) {
    // Skip test if VOD ID is missing from setup.
    console.log('Skipping Playlist Creation test: Missing VOD ID from setup.');
    return;
  }

  // Use a unique identifier
  const uniqueId = `TEST-PL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Create curl command
  const urlSeparator = isWindows ? '^/^/' : '//';

  const rawJsonBody = JSON.stringify({
    title: `Test Playlist via API ${uniqueId}`,
    description: 'Created via API test',
  });

  // FIX: Unified JSON escaping for POST/PUT requests
  let dataArgument;
  const escapedJsonBody = rawJsonBody.replace(/"/g, '\\"');
  dataArgument = `"${escapedJsonBody}"`;

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/playlists -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d ${dataArgument}`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );

    // Check HTTP status code
    expect(httpStatus).toBe(200);

    if (response && response.id) {
      createdPlaylistId = response.id;
      console.log(`Created playlist ID: ${createdPlaylistId}`);
    }

    expect(response.id).toBe(createdPlaylistId);
    expect(response.title).toContain('Test Playlist via API');
    expect(response.description).toBe('Created via API test');
  } catch (error) {
    throw error;
  }
});

/**
 * TEST: Update playlist via API (Add VOD)
 *
 * Playwright timeout set high (25 minutes) to allow enough time
 * for VOD processing to complete (which can take up to 10 minutes).
 */
test('Update playlist via API (Add VOD)', async () => {
  if (!createdPlaylistId || !createdVodId) {
    console.log(
      'Skipping Update Playlist test: Missing Playlist ID or VOD ID.',
    );
    return;
  }

  // Set Playwright timeout: 25 minutes (1,500,000 ms).
  // This prevents the test from timing out during the long VOD Polling.
  test.setTimeout(1500000);

  // Polling: Wait for playlist availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

  // CRITICAL WAIT: Wait for VOD processing completion (20 minutes = 80 attempts * 15 seconds)
  await pollForResourceAvailability(createdVodId, 'vod', 80, 15000);

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Create curl command
  const newDescription = 'Updated description via API (with VOD added)';
  const timestamp = new Date().toISOString();
  const newTitle = `Updated playlist title via API ${timestamp}`;
  const urlSeparator = isWindows ? '^/^/' : '//';

  // In V2 API, 'vod_ids' field is used to add VODs
  const rawJsonBody = JSON.stringify({
    description: newDescription,
    title: newTitle,
    vod_ids: [createdVodId],
  });

  // FIX: Unified JSON escaping for POST/PUT requests
  let dataArgument;
  const escapedJsonBody = rawJsonBody.replace(/"/g, '\\"');
  dataArgument = `"${escapedJsonBody}"`;

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT https:${urlSeparator}${hostAPI}/v2/playlists/${createdPlaylistId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d ${dataArgument}`;

  try {
    const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env);
    expect(httpStatus).toBe(200);
  } catch (error) {
    throw error;
  }
});

/**
 * TEST: Get playlist list and find created playlist
 */
test('Get playlist list and find created playlist', async () => {
  if (!createdPlaylistId) {
    console.log('Skipping Get Playlist List test: No Playlist ID available.');
    return;
  }

  // Polling: Wait for playlist availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Create curl command
  const urlSeparator = isWindows ? '^/^/' : '//';

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "https:${urlSeparator}${hostAPI}/v2/playlists?page=1&per_page=15" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );
    expect(httpStatus).toBe(200);

    let foundPlaylist = null;
    if (response && response.data && Array.isArray(response.data)) {
      foundPlaylist = response.data.find(
        (playlist) => playlist.id === createdPlaylistId,
      );
    } else {
      console.log('Response does not contain data array');
    }

    expect(foundPlaylist).toBeTruthy();
    expect(foundPlaylist.id).toBe(createdPlaylistId);
  } catch (error) {
    throw error;
  }
});

/**
 * TEST: Lookup playlist info via curl (Verify VOD addition)
 */
test('Lookup playlist info via curl (Verify VOD addition)', async () => {
  if (!createdPlaylistId || !createdVodId) {
    console.log(
      'Skipping Playlist Lookup test: Missing Playlist ID or VOD ID.',
    );
    return;
  }

  // Polling 1: Wait for playlist resource availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

  // Polling 2: CRITICAL NEW POLL: Wait for the VOD ID to appear in the vod_ids array (Now max 70s)
  await pollForVodInPlaylist(createdPlaylistId, createdVodId);

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const playlistIdToUse = createdPlaylistId;

  // Create curl command
  const urlSeparator = isWindows ? '^/^/' : '//';

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/playlists/${playlistIdToUse} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );
    expect(httpStatus).toBe(200);

    expect(response.id).toBe(createdPlaylistId);
    expect(response.title).toContain('Updated playlist title via API');

    // CHECK: Verify that VOD ID was added to the playlist
    expect(response.vod_ids).toBeDefined(); // Now this should pass due to the new poll
    expect(Array.isArray(response.vod_ids)).toBe(true);
    expect(response.vod_ids).toContain(createdVodId);
  } catch (error) {
    throw error;
  }
});

/**
 * CLEANUP TEST: Delete playlist.
 */
test('CLEANUP: Delete playlist via API', async () => {
  if (!createdPlaylistId) {
    console.log('Skipping Playlist Deletion test: No Playlist ID available.');
    return;
  }

  // Polling: Wait for playlist availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const playlistIdToUse = createdPlaylistId;

  // Create curl command
  const urlSeparator = isWindows ? '^/^/' : '//';

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE https:${urlSeparator}${hostAPI}/v2/playlists/${playlistIdToUse} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env);
    expect(httpStatus).toBe(204);

    if (createdPlaylistId) {
      console.log(`Successfully deleted playlist ID: ${createdPlaylistId}`);
      createdPlaylistId = null;
    }
  } catch (error) {
    throw error;
  }
});

/**
 * CLEANUP: Delete VOD created for Playlist Test.
 */
test('CLEANUP: Delete VOD created for Playlist Test', async () => {
  if (!createdVodId) {
    console.log('No VOD ID found to delete. Skipping VOD cleanup.');
    return;
  }

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const vodIdToUse = createdVodId;
  const urlSeparator = isWindows ? '^/^/' : '//';

  // Delete VOD via standard endpoint /v2/vod/{id}
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE https:${urlSeparator}${hostAPI}/v2/vod/${vodIdToUse} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env);

    // Expect 204 No Content
    expect(httpStatus).toBe(204);

    if (createdVodId) {
      console.log(`Successfully deleted VOD ID: ${createdVodId}`);
      createdVodId = null;
    }
  } catch (error) {
    throw error;
  }
});
