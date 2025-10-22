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
  env === 'prod' // ИСПРАВЛЕНО: Заменена двойная кавычка на одинарную
    ? process.env._API_KEY
    : env === 'stage' // ИСПРАВЛЕНО: Заменена двойная кавычка на одинарную
    ? process.env._API_KEY_STAGE
    : process.env._API_KEY_DEV;

// Variable to store the created playlist ID
let createdPlaylistId = null;

// --- Helper functions for Polling ---

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the API using a GET request until the resource becomes available (HTTP 200).
 * @param {string} id Playlist ID to check.
 * @param {number} maxAttempts Maximum number of attempts (6 * 10s = 60s = 1 minute).
 * @param {number} delayMs Delay between attempts in milliseconds.
 */
const pollForPlaylistAvailability = async (
  id,
  maxAttempts = 6,
  delayMs = 10000,
) => {
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "https:${urlSeparator}${hostAPI}/v2/playlists/${id}" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Polling for playlist ${id} availability (Attempt ${attempt}/${maxAttempts})...`,
    );

    try {
      const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env, {
        skipLogging: true,
      });

      if (httpStatus === 200) {
        console.log(`Playlist ${id} is available (Status 200).`);
        return true;
      } else if (httpStatus === 404) {
        console.log(`Playlist ${id} not found yet (Status 404). Waiting...`);
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
    `Playlist ${id} was not available after ${maxAttempts} attempts (1 minute timeout).`,
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
  const isWindows = process.platform === 'win32';
  const { skipLogging } = options;

  // --- START: Shell Fixes ---
  if (isWindows) {
    // On Windows, wrap the URL in double quotes to prevent & from being interpreted as command separator
    // We look for http(s)://... that is followed by a space or end of string.
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = finalCmd.match(urlRegex);

    // This pattern checks if the URL is followed by a header flag (-H) or is at the end of the line
    if (urlMatch && urlMatch[0].includes('?')) {
      const url = urlMatch[0];
      // Only wrap if it's not already wrapped
      if (!url.startsWith('"') && !url.endsWith('"')) {
        finalCmd = finalCmd.replace(url, `"${url}"`);
      }
    }

    // Escape remaining '&' for Windows CMD (e.g., in JSON body) and other unquoted URL & characters.
    // This is necessary for arguments passed to the shell that contain special characters.
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

test('Create playlist via API', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Use a unique identifier instead of the exact date
  const uniqueId = `TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const jsonBody = `{\\\"title\\\":\\\"Test Playlist via API ${uniqueId}\\\",\\\"description\\\":\\\"Created via API test\\\"}`;

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/playlists -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${jsonBody}"`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );

    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 For successful POST request

    // Store the playlist ID
    if (response && response.id) {
      createdPlaylistId = response.id;
      console.log(`Created playlist ID: ${createdPlaylistId}`);
    }

    // Assertions
    expect(response.id).toBe(createdPlaylistId);
    expect(response.title).toContain('Test Playlist via API');
    expect(response.description).toBe('Created via API test');
  } catch (error) {
    throw error;
  }
});

test('Update playlist via API', async () => {
  // Dependency check: force failure if ID is missing.
  if (!createdPlaylistId) {
    throw new Error(
      'No Playlist ID available from Test 1 (POST). Test 1 must run before Test 2.',
    );
  }

  // --- POLLING: Wait until the resource is available ---
  await pollForPlaylistAvailability(createdPlaylistId);

  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const newDescription = 'Updated description via API';
  const timestamp = new Date().toISOString();
  const newTitle = `Updated playlist title via API ${timestamp}`;
  const urlSeparator = isWindows ? '^/^/' : '//';
  const jsonBody = `{\\\"description\\\":\\\"${newDescription}\\\",\\\"title\\\":\\\"${newTitle}\\\"}`;

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT https:${urlSeparator}${hostAPI}/v2/playlists/${createdPlaylistId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${jsonBody}"`;

  try {
    const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env);

    // Validate HTTP status code
    expect(httpStatus).toBe(200);
  } catch (error) {
    throw error;
  }
});

test('Get playlist list and find created playlist', async () => {
  // Dependency check: force failure if ID is missing.
  if (!createdPlaylistId) {
    throw new Error(
      'No Playlist ID available from Test 1 (POST). Test 1 must run before Get List test.',
    );
  }

  // --- POLLING: Wait until the resource is available ---
  await pollForPlaylistAvailability(createdPlaylistId);

  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';

  // NOTE: The URL containing '&' MUST be quoted for Unix shells (like /bin/sh) to prevent
  // '&' from being interpreted as a command separator. This was the fix for the previous error.
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET "https:${urlSeparator}${hostAPI}/v2/playlists?page=1&per_page=15" -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );

    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful GET request

    // Look for the created playlist in the list
    let foundPlaylist = null;
    if (response && response.data && Array.isArray(response.data)) {
      foundPlaylist = response.data.find(
        (playlist) => playlist.id === createdPlaylistId,
      );
    } else {
      console.log('Response does not contain data array');
    }

    // Assertions
    expect(foundPlaylist).toBeTruthy();
    expect(foundPlaylist.id).toBe(createdPlaylistId);
  } catch (error) {
    throw error;
  }
});

test('Lookup playlist info via curl', async () => {
  // Dependency check: force failure if ID is missing.
  if (!createdPlaylistId) {
    throw new Error(
      'No Playlist ID available from Test 1 (POST). Test 1 must run before Lookup test.',
    );
  }

  // --- POLLING: Wait until the resource is available ---
  await pollForPlaylistAvailability(createdPlaylistId);

  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const playlistIdToUse = createdPlaylistId;

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/playlists/${playlistIdToUse} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus, response } = await executeCurlRequest(
      curlCmd,
      apiKey,
      env,
    );

    // If ID is valid, expect 200
    expect(httpStatus).toBe(200);

    // Assertions
    expect(response.id).toBe(createdPlaylistId);
    expect(response.title).toContain('Updated playlist title via API');
    expect(response.description).toBe('Updated description via API');
  } catch (error) {
    throw error;
  }
});

test('Delete playlist via API', async () => {
  // Dependency check: force failure if ID is missing.
  if (!createdPlaylistId) {
    throw new Error(
      'No Playlist ID available from Test 1 (POST). Test 1 must run before Delete test.',
    );
  }

  // --- POLLING: Wait until the resource is available ---
  await pollForPlaylistAvailability(createdPlaylistId);

  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  const playlistIdToUse = createdPlaylistId;

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE https:${urlSeparator}${hostAPI}/v2/playlists/${playlistIdToUse} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  try {
    const { httpStatus } = await executeCurlRequest(curlCmd, apiKey, env);

    // If ID is correct, expect 204.
    expect(httpStatus).toBe(204);

    if (createdPlaylistId) {
      console.log(`Successfully deleted playlist ID: ${createdPlaylistId}`);
      // Reset ID after successful cleanup
      createdPlaylistId = null;
    }
  } catch (error) {
    throw error;
  }
});
