const { test, expect } = require('./utils');
const { exec } = require('child_process');
const { promisify } = require('util');
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
    : process.env._API_KEY_DEV;

// Variables to store created resources
let createdVodId = null;
let createdPlaylistId = null;

// Determine platform for curl command escaping
const isWindows = process.platform === 'win32';

// --- Helper functions for Polling ---

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// --- API Tests ---

/**
 * SETUP: Create VOD Resource for Playlist Test (cURL Flow)
 * (POST /v2/vod)
 */
test('SETUP: Create VOD Resource for Playlist Test (cURL Flow)', async () => {
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const filename = 'sample_video.MOV';
  const vodTitle = `Test VOD cURL Base ${Date.now()}`;

  const urlSeparator = isWindows ? '^/^/' : '//';

  // 1. Create raw JSON body
  const rawJsonBody = JSON.stringify({
    title: vodTitle,
    source: filename,
    upload_type: 'curl',
  });

  // 2. Determine -d argument based on OS
  let dataArgument;
  if (isWindows) {
    const escapedJsonBody = rawJsonBody.replace(/"/g, '\\"');
    dataArgument = `"${escapedJsonBody}"`;
  } else {
    dataArgument = `'${rawJsonBody}'`;
  }

  // 3. Form the complete curl command
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/vod -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d ${dataArgument}`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );

    // Expect 200 OK for successful resource creation
    expect(httpStatus).toBe(200);

    // Extract VOD ID
    if (response && response.id) {
      createdVodId = response.id;
      console.log(`Created VOD ID: ${createdVodId}`);
    }

    expect(createdVodId).toBeDefined();
  } catch (error) {
    throw error;
  }
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

  let dataArgument;
  if (isWindows) {
    const escapedJsonBody = rawJsonBody.replace(/"/g, '\\"');
    dataArgument = `"${escapedJsonBody}"`;
  } else {
    dataArgument = `'${rawJsonBody}'`;
  }

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
 */
test('Update playlist via API (Add VOD)', async () => {
  if (!createdPlaylistId || !createdVodId) {
    console.log(
      'Skipping Update Playlist test: Missing Playlist ID or VOD ID.',
    );
    return;
  }

  // Polling: Wait for playlist availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

  // CRITICAL WAIT: Wait for VOD processing completion (10 minutes)
  await pollForResourceAvailability(createdVodId, 'vod', 40, 15000);

  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Create curl command
  const newDescription = 'Updated description via API (with VOD added)';
  const timestamp = new Date().toISOString();
  const newTitle = `Updated playlist title via API ${timestamp}`;
  const urlSeparator = isWindows ? '^/^/' : '//';

  const rawJsonBody = JSON.stringify({
    description: newDescription,
    title: newTitle,
    vod_ids: [createdVodId],
  });

  let dataArgument;
  if (isWindows) {
    const escapedJsonBody = rawJsonBody.replace(/"/g, '\\"');
    dataArgument = `"${escapedJsonBody}"`;
  } else {
    dataArgument = `'${rawJsonBody}'`;
  }

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

  // Polling: Wait for playlist availability
  await pollForResourceAvailability(createdPlaylistId, 'playlists');

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
    expect(response.vod_ids).toBeDefined();
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

  // CRITICAL WAIT: Wait for VOD processing completion (10 minutes)
  await pollForResourceAvailability(createdVodId, 'vod', 40, 15000);

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
