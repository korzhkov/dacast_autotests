// --- Required Playwright and Node.js Modules ---
const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// --- ENVIRONMENT AND AUTHORIZATION CONFIGURATION ---

// Get environment from WORKENV variable or set 'prod' by default
const env = process.env.WORKENV || 'prod';
console.log(`Current environment for API tests: ${env}`);

// Define the base API URL depending on the environment
const hostAPI =
  env === 'prod'
    ? process.env._HOST_API
    : env === 'stage'
    ? process.env._HOST_API_STAGE
    : process.env._HOST_API_DEV;

// API keys for positive and negative tests (require variables in .env)
// Использование _API_KEY (ваш основной ключ) для позитивных тестов
const ownerApiKey = process.env._API_KEY;
const otherApiKey = process.env._API_KEY_OTHER;

// VOD ID for positive and negative tests
const ownerVodId = process.env._VOD_ID; // Обновлено с _VOD_ID_OWNER
const otherVodId = process.env._VOD_ID_OTHER; // ID for GET/PUT/DELETE (negative)

// Variable to store the ID of the new VOD created by the POST request (used for DELETE)
let createdVodId = null;

// Check that necessary data is loaded
if (!ownerApiKey || !ownerVodId || !otherApiKey || !otherVodId || !hostAPI) {
  let missingVars = [];

  // API key check
  if (!ownerApiKey) missingVars.push('_API_KEY'); // Обновлено с _API_KEY_OWNER
  if (!ownerVodId) missingVars.push('_VOD_ID'); // Обновлено с _VOD_ID_OWNER
  if (!otherApiKey) missingVars.push('_API_KEY_OTHER');
  if (!otherVodId) missingVars.push('_VOD_ID_OTHER');

  // Check host variable based on the current environment
  if (!hostAPI) {
    if (env === 'prod') missingVars.push('_HOST_API');
    else if (env === 'stage') missingVars.push('_HOST_API_STAGE');
    else if (env === 'dev') missingVars.push('_HOST_API_DEV');
    else missingVars.push('Host variable for environment ' + env);
  }

  throw new Error(
    `\n--- CONFIGURATION ERROR ---\nFailed to load all necessary environment variables for API tests.\nMissing variables:\n${missingVars.join(
      '\n',
    )}\n--------------------------\n`,
  );
}

// Variable for key masking
const MASK_KEY = ownerApiKey.substring(0, 5) + '...';
// Helper function for correct URL formatting in curl (escaping for Windows/Linux)
const isWindows = process.platform === 'win32';
const urlSeparator = isWindows ? '^/^/' : '//';

// --- UTILITY FUNCTIONS (similar to test-utils.js) ---

/**
 * Generates a random string of characters to ensure data uniqueness in the test.
 * @param {number} length The length of the generated string.
 * @returns {string} A random string.
 */
function generateRandomId(length = 8) {
  return Math.random()
    .toString(16)
    .substring(2, 2 + length);
}

/**
 * Parses the output of the curl command that uses -w "\\nHTTPSTATUS:%{http_code}"
 * to separate the status code from the response body.
 */
async function parseCurlResponse(stdout) {
  const lines = stdout.split('\n');
  const statusLine = lines.find((line) => line.startsWith('HTTPSTATUS:'));
  const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;

  // Remove extra lines and parse the response body
  const responseBodyRaw = lines
    .filter((line) => !line.startsWith('HTTPSTATUS:'))
    .join('\n')
    .trim();

  let responseBody = {};
  try {
    responseBody = JSON.parse(responseBodyRaw);
  } catch (e) {
    // Ignore parsing error if an empty response is expected (e.g., 204 No Content)
  }

  return { httpStatus, responseBody, responseBodyRaw };
}

/**
 * Executes the curl command and processes the response.
 */
async function executeCurlRequest(curlCmd, maskKey, env) {
  const maskedCmd = curlCmd.replace(maskKey, 'XXXXX');
  console.log('\nExecuting curl command:', maskedCmd);

  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);

    if (stderr) {
      // Stderr errors can occur even upon successful execution,
      // but we log them for debugging.
      console.warn('Curl stderr (Warning):', stderr.trim());
    }

    const { httpStatus, responseBody, responseBodyRaw } =
      await parseCurlResponse(stdout);

    console.log(`HTTP Status Code: ${httpStatus}`);

    return { httpStatus, responseBody, responseBodyRaw };
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
}

// --- API ENDPOINT CONSTANTS ---

const BASE_URL = `https:${urlSeparator}${hostAPI}/v2`;
const POST_ENDPOINT = '/videos';
const PUT_ENDPOINT = '/vod/';
const GET_ENDPOINT = '/videos/';

// --- VOD API TESTS ---

// Request body for POST (Initiating upload)
const CREATE_BODY = {
  source: 'sample_video.MOV', // The filename that should be in the project root
  upload_type: 'curl',
};
const CREATE_JSON_BODY = JSON.stringify(CREATE_BODY).replace(/"/g, '\\"');

// Base part of the request body for PUT (Update).
const UPDATE_BASE_TITLE = `Automated Stream Update ID: `;
const UPDATE_DESCRIPTION = 'Updated description via automated test';

// ===============================================
// POST TESTS (VOD INITIATION AND UPLOAD)
// ===============================================

// Test 1: POSITIVE POST - Initiate and upload VOD (expect 200 OK)
test('POST VOD (1): should initiate and upload VOD successfully with correct credentials (200)', async () => {
  // Set a higher timeout for the test which includes the upload
  test.setTimeout(120000);

  const url = `${BASE_URL}${POST_ENDPOINT}`;

  // STEP 1: INITIATE UPLOAD (POST /v2/videos)
  const initCurlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${CREATE_JSON_BODY}"`;

  console.log('--- STEP 1: Initiate VOD and retrieve upload command ---');
  const { httpStatus, responseBody } = await executeCurlRequest(
    initCurlCmd,
    ownerApiKey,
    env,
  );

  // Expect 200 OK
  expect(httpStatus).toBe(200);

  // Check that the response contains the new VOD ID and the upload command
  expect(responseBody).toHaveProperty('id');
  expect(responseBody).toHaveProperty('curl-command');

  // Save the ID for subsequent use in the DELETE test (Test 8)
  createdVodId = responseBody.id;
  const uploadCurlCmd = responseBody['curl-command'];
  console.log(`Successfully initiated VOD with ID: ${createdVodId}`);

  // STEP 2: EXECUTE FILE UPLOAD (exec uploadCurlCmd)
  if (uploadCurlCmd) {
    // Ensure the command contains -k (to ignore certificate issues)
    let finalUploadCmd = uploadCurlCmd.includes(' -k ')
      ? uploadCurlCmd
      : uploadCurlCmd.replace('curl', 'curl -k');

    // IMPORTANT: We replace the universal file placeholder with the actual filename
    // with the @ prefix, as required by curl for upload.
    // We assume that sample_video.MOV is available in the current working directory.
    finalUploadCmd = finalUploadCmd.replace(
      '@/path/to/file',
      `@sample_video.MOV`,
    );

    console.log('--- STEP 2: Execute file upload (sample_video.MOV) ---');
    // Execute the command without expecting HTTPSTATUS, as this is an S3 request,
    // which returns 200, but we cannot easily verify it.
    await execAsync(finalUploadCmd);
    console.log(`VOD file upload command executed successfully.`);
  } else {
    throw new Error('Upload curl command not found in API response.');
  }
});

// ===============================================
// PUT TESTS (VIDEO UPDATE)
// ===============================================

// Test 2: POSITIVE PUT - Update own video (expect 200 OK)
test('PUT VOD (2): should update VOD title successfully with correct credentials (200)', async () => {
  const url = `${BASE_URL}${PUT_ENDPOINT}${ownerVodId}`;

  // GENERATE A RANDOM ID RIGHT BEFORE THE REQUEST
  const randomId = generateRandomId();
  const dynamicTitle = UPDATE_BASE_TITLE + randomId;

  const dynamicUpdateBody = {
    title: dynamicTitle,
    description: UPDATE_DESCRIPTION,
    online: true,
  };

  const dynamicUpdateJsonBody = JSON.stringify(dynamicUpdateBody).replace(
    /"/g,
    '\\"',
  );

  // Send the request with the new unique title
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${dynamicUpdateJsonBody}"`;

  const { httpStatus, responseBody } = await executeCurlRequest(
    curlCmd,
    ownerApiKey,
    env,
  );

  expect(httpStatus).toBe(200);

  // Check that the response body contains the updated data, using the description field
  expect(responseBody.description).toBe(UPDATE_DESCRIPTION);
});

// Test 3: NEGATIVE PUT - Invalid API key (expect 403 Forbidden)
test('PUT VOD (3): should fail with 403 when using an API Key from a different account', async () => {
  const url = `${BASE_URL}${PUT_ENDPOINT}${ownerVodId}`;

  // Use a simple (non-dynamic) request for the negative test
  const dummyUpdateBody = {
    title: 'Dummy title for 403 check',
    description: 'Dummy description',
    online: true,
  };
  const dummyUpdateJsonBody = JSON.stringify(dummyUpdateBody).replace(
    /"/g,
    '\\"',
  );

  // Use ANOTHER USER's API_KEY but OUR OWN VOD_ID
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT ${url} -H "X-Api-Key: ${otherApiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${dummyUpdateJsonBody}"`;

  // Mask the other user's key in logs
  const { httpStatus } = await executeCurlRequest(curlCmd, otherApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});

// Test 4: NEGATIVE PUT - Invalid VOD ID (expect 403 Forbidden)
test('PUT VOD (4): should fail with 403 when using a VOD ID from a different account (403)', async () => {
  const url = `${BASE_URL}${PUT_ENDPOINT}${otherVodId}`;

  // Use a simple (non-dynamic) request for the negative test
  const dummyUpdateBody = {
    title: 'Dummy title for 403 check',
    description: 'Dummy description',
    online: true,
  };
  const dummyUpdateJsonBody = JSON.stringify(dummyUpdateBody).replace(
    /"/g,
    '\\"',
  );

  // Use OUR OWN API_KEY but ANOTHER USER's VOD_ID
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "${dummyUpdateJsonBody}"`;

  const { httpStatus } = await executeCurlRequest(curlCmd, ownerApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});

// ===============================================
// GET TESTS (RETRIEVING INFORMATION)
// ===============================================

// Test 5: POSITIVE GET - Retrieve own video information (expect 200 OK)
test('GET VOD (5): should retrieve VOD info successfully with correct credentials (200)', async () => {
  const url = `${BASE_URL}${GET_ENDPOINT}${ownerVodId}`;

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default"`;

  const { httpStatus, responseBody } = await executeCurlRequest(
    curlCmd,
    ownerApiKey,
    env,
  );

  expect(httpStatus).toBe(200);

  // Check that the response body contains key fields
  expect(responseBody).toHaveProperty('id', ownerVodId);
  expect(responseBody).toHaveProperty('title');
});

// Test 6: NEGATIVE GET - Invalid API key (expect 403 Forbidden)
test('GET VOD (6): should fail with 403 when trying to get info with an API Key from a different account', async () => {
  const url = `${BASE_URL}${GET_ENDPOINT}${ownerVodId}`;

  // Use ANOTHER USER's API_KEY
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET ${url} -H "X-Api-Key: ${otherApiKey}" -H "X-Format: default"`;

  const { httpStatus } = await executeCurlRequest(curlCmd, otherApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});

// Test 7: NEGATIVE GET - Invalid VOD ID (expect 403 Forbidden)
test('GET VOD (7): should fail with 403 when trying to get info about a VOD ID from a different account', async () => {
  const url = `${BASE_URL}${GET_ENDPOINT}${otherVodId}`;

  // Use OUR OWN API_KEY but ANOTHER USER's VOD_ID
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default"`;

  const { httpStatus } = await executeCurlRequest(curlCmd, ownerApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});

// ===============================================
// DELETE TESTS (VIDEO DELETION)
// ===============================================

// Test 8: POSITIVE DELETE - Delete own video (expect 204 No Content)
// *** USES THE VOD ID CREATED IN TEST 1 (POST) TO CLEAN UP RESOURCES ***
test('DELETE VOD (8): should delete the VOD created in POST test (1) successfully (204)', async () => {
  // NOTE: If deletion fails in this test with a 404 error, it means
  // that the VOD was not indexed on the backend in time.
  // If Test 1 was successful but Test 8 fails,
  // you may need to manually increase the waiting timeout before running the entire test suite.

  // Check that the ID was created in the previous test.
  expect(createdVodId).not.toBeNull();

  // STEP 1: Delete the resource that was created in Test 1.
  const url = `${BASE_URL}${PUT_ENDPOINT}${createdVodId}`; // PUT_ENDPOINT is also used for DELETE /vod/{id}

  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default"`;

  const { httpStatus } = await executeCurlRequest(curlCmd, ownerApiKey, env);

  // 204 No Content is expected upon successful deletion
  expect(httpStatus).toBe(204);
});

// Test 9: NEGATIVE DELETE - Invalid API key (expect 403 Forbidden)
test('DELETE VOD (9): should fail with 403 when using an API Key from a different account', async () => {
  const url = `${BASE_URL}${PUT_ENDPOINT}${ownerVodId}`;

  // Use ANOTHER USER's API_KEY but OUR OWN VOD_ID
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE ${url} -H "X-Api-Key: ${otherApiKey}" -H "X-Format: default"`;

  // Mask the other user's key in logs
  const { httpStatus } = await executeCurlRequest(curlCmd, otherApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});

// Test 10: NEGATIVE DELETE - Invalid VOD ID (expect 403 Forbidden)
test('DELETE VOD (10): should fail with 403 when using a VOD ID from a different account', async () => {
  const url = `${BASE_URL}${PUT_ENDPOINT}${otherVodId}`;

  // Use OUR OWN API_KEY but ANOTHER USER's VOD_ID
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE ${url} -H "X-Api-Key: ${ownerApiKey}" -H "X-Format: default"`;

  const { httpStatus } = await executeCurlRequest(curlCmd, ownerApiKey, env);

  // Assertion: The test passes if the API returns 403 (access denied)
  expect(httpStatus).toBe(403);
});
