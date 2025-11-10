/*
What this series of tests does:
1. Creates V2 stream via API with live_recording_enabled and live_dvr_enabled set to true
2. Verifies that API response for created stream has HTTP status 201, live_recording_enabled and live_dvr_enabled set to true, ingest_version is v2, and correct publishing_point_primary for environment
3. [STAGE/DEV ONLY] Adds a simulcast destination with rtmp_url and stream_key, verifies HTTP 201 response
4. [STAGE/DEV ONLY] Gets list of simulcast destinations, verifies the added simulcast exists by stream_key, saves simulcast ID
5. [STAGE/DEV ONLY] Deletes the simulcast destination, verifies HTTP 200 and confirms deletion by checking the list again
6. Updates stream description (to "Updated description via API") and title (to "Updated stream title via API" + timestamp), sets live_recording_enabled to false and live_dvr_enabled to false
7. Verifies that API response for updated stream has HTTP status 200, updated description and title, live_recording_enabled is set to false. If PUT response validation fails, makes additional GET request to verify
8. Gets list of streams and verifies that API response has HTTP status 200 and created stream exists in the list
9. Gets stream info via GET and verifies that API response has HTTP status 200, created stream exists in info, live_recording_enabled is set to false, live_dvr_enabled is set to false (V2 DVR auto-disables with recording)
10. Deletes the created stream and verifies HTTP 204 No Content response
*/

const { test, expect } = require('./utils');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get environment from command line or default to prod
const env = process.env.WORKENV || 'prod';
const hostAPI = env === 'prod' ? process.env._HOST_API : (env === 'stage' ? process.env._HOST_API_STAGE : process.env._HOST_API_DEV);
const apiKey = env === 'prod' ? process.env._API_KEY : (env === 'stage' ? process.env._API_KEY_STAGE : process.env._API_KEY_DEV);

// Variable to store the created stream ID
let createdStreamId = null;

test('Create stream via API', async () => {
  test.setTimeout(45000); // Increase timeout to 45 seconds for stage environment
  
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/channel -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "{\\\"title\\\":\\\"Test Stream via API ${timestamp}\\\",\\\"description\\\":\\\"Created via API test\\\",\\\"channel_type\\\":\\\"transmux\\\",\\\"region\\\":\\\"north_america\\\",\\\"live_recording_enabled\\\":true,\\\"live_dvr_enabled\\\":true,\\\"ingest_version\\\":\\\"v2\\\"}"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);

  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    console.log('HTTP Status:', httpStatus);
    expect(httpStatus).toBe(201); // 201 Created for successful POST request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      // Try to parse any nested JSON strings in the response
      if (response.details && typeof response.details === 'string') {
        try {
          const nestedJson = JSON.parse(response.details.split('\n')[1]);
          response.details = {
            message: response.details.split('\n')[0],
            trace: nestedJson
          };
        } catch (e) {
          // If nested JSON parsing fails, keep original details
        }
      }

      // console.log('\n=== API Response ===');
      // console.log(JSON.stringify(response, null, 2));
      // console.log('===================\n');

      // Store the stream ID if the request was successful
      if (response.id) {
        createdStreamId = response.id;
        console.log(`Created stream ID: ${createdStreamId}`);
      }
      
      // Validate response fields - if this fails, the test should fail
      // Only check ingest_version on stage/dev environments where it's available
      if (env !== 'prod') {
        expect(response.ingest_version).toBe("v2");
      }
      expect(response.live_recording_enabled).toBe(true);
      expect(response.live_dvr_enabled).toBe(true);
      expect(response.ingest_version).toBe("v2");
      // expect(response.channel_type).toBe("transmux");
      
      // Check publishing_point_primary based on environment
      if (env === 'prod') {
        expect(response.config.publishing_point_primary).toBe("rtmp://rtmp.us.live.dacast.com/live");
      } else if (env === 'stage') {
        expect(response.config.publishing_point_primary).toBe("rtmp://rtmp.us.live.dev.dacast.com/live");
      } else {
        // For dev environment
        expect(response.config.publishing_point_primary).toBe("rtmp://rtmp.us.live.dev.dacast.com/live");
      }
      
      

    } catch (e) {
      // console.log('\n=== Raw API Response ===');
      // console.log(responseBody);
      // console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }

    // Wait 5 seconds for stream to be indexed
    console.log('Waiting 5 seconds for stream to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Wait complete, proceeding to update stream test.');

});

// Variable to store the simulcast destination ID
let simulcastId = null;
const expectedStreamKey = 'live_stream_key_test_autotests';

// TODO: Remove test.skip() when simulcast API is available in prod
(env === 'prod' ? test.skip : test)('Add Simulcast Destination', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X POST https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId}/simulcast-destinations -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "{\\\"rtmp_url\\\":\\\"rtmp://live.twitch.tv/app/\\\",\\\"stream_key\\\":\\\"live_stream_key_test_autotests\\\"}"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(201); // 201 Created for successful POST request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n');

      // API returns empty object {} on success
      console.log('Simulcast destination added successfully');

    } catch (e) {
      console.log('\n=== Raw API Response ===');
      console.log(responseBody);
      console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
  
  // Wait 5 seconds for simulcast destination to be indexed
  console.log('Waiting 5 seconds for simulcast destination to be indexed...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Wait complete, proceeding to next test.');
});

// TODO: Remove test.skip() when simulcast API is available in prod
(env === 'prod' ? test.skip : test)('Get Simulcast Destinations list', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId}/simulcast-destinations -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful GET request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n');

      // Validate that response has data array
      expect(response).toHaveProperty('data');
      expect(Array.isArray(response.data)).toBe(true);

      // Find the simulcast destination with our hardcoded stream_key
      const foundSimulcast = response.data.find(item => item.stream_key === expectedStreamKey);
      
      console.log(`Searching for stream_key: ${expectedStreamKey}`);
      console.log(`Total simulcast destinations in list: ${response.data.length}`);
      
      if (foundSimulcast) {
        simulcastId = foundSimulcast.id;
        console.log('Found simulcast destination:', {
          id: foundSimulcast.id,
          rtmp_url: foundSimulcast.rtmp_url,
          stream_key: foundSimulcast.stream_key
        });
        console.log(`Simulcast ID saved: ${simulcastId}`);
      } else {
        console.log('Simulcast destination not found in list');
        console.log('Available stream_keys:', response.data.map(s => s.stream_key));
      }

      // Validate that we found the simulcast destination
      expect(foundSimulcast).toBeTruthy();
      expect(foundSimulcast.stream_key).toBe(expectedStreamKey);
      expect(foundSimulcast.rtmp_url).toBe('rtmp://live.twitch.tv/app/');

    } catch (e) {
      console.log('\n=== Raw API Response ===');
      console.log(responseBody);
      console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});

// TODO: Remove test.skip() when simulcast API is available in prod
(env === 'prod' ? test.skip : test)('Delete Simulcast Destination', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  if (!simulcastId) {
    throw new Error('No simulcast ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId}/simulcast-destinations/${simulcastId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful DELETE request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n');

      // API returns empty object {} on success
      console.log(`Successfully deleted simulcast destination ID: ${simulcastId}`);

    } catch (e) {
      console.log('\n=== Raw API Response ===');
      console.log(responseBody);
      console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
  
  // Wait 5 seconds for deletion to be processed
  console.log('Waiting 5 seconds for deletion to be processed...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Wait complete, verifying deletion...');
  
  // Verify deletion by getting the list again (reuse isWindows and urlSeparator from above)
  const verifyCurlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId}/simulcast-destinations -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;
  
  const maskedVerifyCmd = verifyCurlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing verification curl command:', maskedVerifyCmd);
  
  try {
    const { stdout, stderr } = await execAsync(verifyCurlCmd);
    
    if (stderr) {
      console.error('Verification curl stderr:', stderr);
    }
    
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`Verification HTTP Status Code: ${httpStatus}`);
    expect(httpStatus).toBe(200);
    
    const verifyResponse = JSON.parse(responseBody);
    
    console.log('\n=== Verification API Response ===');
    console.log(JSON.stringify(verifyResponse, null, 2));
    console.log('=================================\n');
    
    // Check that the deleted simulcast is NOT in the list
    if (verifyResponse && verifyResponse.data && Array.isArray(verifyResponse.data)) {
      const deletedSimulcastStillExists = verifyResponse.data.some(item => item.id === simulcastId);
      
      if (deletedSimulcastStillExists) {
        throw new Error(`Simulcast destination ${simulcastId} still exists after deletion!`);
      } else {
        console.log(`✓ Verified: Simulcast destination ${simulcastId} successfully removed from list`);
        console.log(`Current simulcast destinations count: ${verifyResponse.data.length}`);
      }
    } else {
      console.log('✓ Verified: No simulcast destinations in list (expected after deletion)');
    }
    
  } catch (error) {
    console.error('Error during deletion verification:', error.message);
    throw error;
  }
});

test('Update stream via API', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const newDescription = 'Updated description via API';
  const timestamp = new Date().toISOString();
  const newTitle = `Updated stream title via API ${timestamp}`;
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X PUT https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "{\\\"description\\\":\\\"${newDescription}\\\",\\\"title\\\":\\\"${newTitle}\\\",\\\"live_recording_enabled\\\":false,\\\"live_dvr_enabled\\\":false}"`;
  // const curlCmd = `curl -k -X PUT https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "{\\\"description\\\":\\\"${newDescription}\\\"}"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful PUT request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      // Try to parse any nested JSON strings in the response
      if (response.details && typeof response.details === 'string') {
        try {
          const nestedJson = JSON.parse(response.details.split('\n')[1]);
          response.details = {
            message: response.details.split('\n')[0],
            trace: nestedJson
          };
        } catch (e) {
          // If nested JSON parsing fails, keep original details
        }
      }

      /* console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n'); */

      /* Log response object structure for debugging
      console.log('\n=== Response Object Structure ===');
      console.log('Available fields and values:');
      Object.entries(response).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      console.log('===============================\n'); */

      // Try to validate fields from PUT response
      let validationPassed = false;
      try {
        expect(response.description).toBe(newDescription);
        expect(response.title).toBe(newTitle);
        expect(response.live_recording_enabled).toBe(false);
        expect(response.live_recording_enabled).toBe(true);
        validationPassed = true;
        console.log('PUT response validation passed');
      } catch (validationError) {
        console.warn('PUT response validation failed:', validationError.message);
        console.log('Making additional GET request to verify update...');
        
        // Fallback: Make a GET request to verify the update
        const getCurlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;
        const maskedGetCmd = getCurlCmd.replace(apiKey, 'XXXXX');
        console.log('Executing GET curl command:', maskedGetCmd);
        
        try {
          const { stdout: getStdout, stderr: getStderr } = await execAsync(getCurlCmd);
          
          if (getStderr) {
            console.error('GET curl stderr:', getStderr);
          }
          
          const getLines = getStdout.split('\n');
          const getStatusLine = getLines.find(line => line.startsWith('HTTPSTATUS:'));
          const getHttpStatus = getStatusLine ? parseInt(getStatusLine.split(':')[1]) : null;
          const getResponseBody = getLines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
          
          console.log(`GET HTTP Status Code: ${getHttpStatus}`);
          expect(getHttpStatus).toBe(200);
          
          const getResponse = JSON.parse(getResponseBody);
          
          /* console.log('\n=== GET Response Object Structure ===');
          console.log('Available fields and values:');
          Object.entries(getResponse).forEach(([key, value]) => {
            console.log(`${key}:`, value);
          });
          console.log('====================================\n'); */
          
          // Validate fields from GET response
          expect(getResponse.description).toBe(newDescription);
          expect(getResponse.title).toBe(newTitle);
          expect(getResponse.live_recording_enabled).toBe(false);
          console.log('GET response validation passed');
          
          // Mark test as flaky since PUT response was inconsistent
          test.info().annotations.push({
            type: 'flaky',
            description: 'PUT response validation failed, but GET response validation passed. API may have delay in returning updated values.'
          });
          console.warn('⚠️  Test marked as FLAKY - PUT response was inconsistent');
          
        } catch (getError) {
          console.error('GET request failed:', getError.message);
          throw getError;
        }
      }

    } catch (e) {
      // console.log('\n=== Raw API Response ===');
      // console.log(responseBody);
      // console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});

test('Get stream list and find created stream', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/channel?per_page=15 -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;


  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful GET request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      // Try to parse any nested JSON strings in the response
      if (response.details && typeof response.details === 'string') {
        try {
          const nestedJson = JSON.parse(response.details.split('\n')[1]);
          response.details = {
            message: response.details.split('\n')[0],
            trace: nestedJson
          };
        } catch (e) {
          // If nested JSON parsing fails, keep original details
        }
      }

      /* console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n'); */

      /* Log response structure for debugging
      console.log('\n=== Response Object Structure ===');
      console.log('Available fields and values:');
      Object.entries(response).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      console.log('===============================\n'); */

      // Look for the created stream in the list
      let foundStream = null;
      if (response.data && Array.isArray(response.data)) {
        foundStream = response.data.find(stream => stream.id === createdStreamId);
        console.log(`Searching for stream ID: ${createdStreamId}`);
        console.log(`Total streams in list: ${response.data.length}`);
        
        if (foundStream) {
          console.log('Found created stream in list:', {
            id: foundStream.id,
            title: foundStream.title,
            description: foundStream.description
          });
        } else {
          console.log('Created stream not found in list');
          console.log('Available stream IDs:', response.data.map(s => s.id));
        }
      } else {
        console.log('Response does not contain data array');
      }

      // Validate that we found the created stream
      expect(foundStream).toBeTruthy();
      expect(foundStream.id).toBe(createdStreamId);

    } catch (e) {
      // console.log('\n=== Raw API Response ===');
      // console.log(responseBody);
      // console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});

test('Lookup stream info via curl', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X GET https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(200); // 200 OK for successful GET request
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(responseBody);
      
      // Try to parse any nested JSON strings in the response
      if (response.details && typeof response.details === 'string') {
        try {
          const nestedJson = JSON.parse(response.details.split('\n')[1]);
          response.details = {
            message: response.details.split('\n')[0],
            trace: nestedJson
          };
        } catch (e) {
          // If nested JSON parsing fails, keep original details
        }
      }

      /* console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n'); */

      /* Temporary debug logging
      console.log('Response structure:', {
        live_recording_enabled: response.live_recording_enabled,
        live_dvr_enabled: response.live_dvr_enabled
      }); */

      // Store the stream ID if the request was successful (even if validation fails)
      if (response.id) {
        createdStreamId = response.id;
        console.log(`Retrieved stream ID: ${createdStreamId}`);
      }

      // Add assertions to check response parameters
      expect(response.live_recording_enabled).toBe(false);
      expect(response.dvr_enabled).toBe(false);

    } catch (e) {
      // console.log('\n=== Raw API Response ===');
      // console.log(responseBody);
      // console.log('=======================\n');
      throw e; // Re-throw the error to fail the test
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});

test('CLEANUP: Delete stream via API', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }
  
  if (!createdStreamId) {
    throw new Error('No stream ID available from previous test');
  }
  
  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const urlSeparator = isWindows ? '^/^/' : '//';
  const curlCmd = `curl -k -w "\\nHTTPSTATUS:%{http_code}" -X DELETE https:${urlSeparator}${hostAPI}/v2/channel/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  // Output command to console (masking API key for security)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Extract HTTP status code from response
    const lines = stdout.split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const httpStatus = statusLine ? parseInt(statusLine.split(':')[1]) : null;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n').trim();
    
    console.log(`HTTP Status Code: ${httpStatus}`);
    console.log(`Response Body: "${responseBody}"`);
    
    // Validate HTTP status code
    expect(httpStatus).toBe(204); // 204 No Content for successful DELETE request
    
    console.log(`Successfully deleted stream ID: ${createdStreamId}`);
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});
