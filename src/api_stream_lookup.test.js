const { test } = require('./utils');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get environment from command line or default to prod
const env = process.env.WORKENV || 'prod';
const hostAPI = env === 'prod' ? process.env._HOST_API : (env === 'stage' ? process.env._HOST_API_STAGE : process.env._HOST_API_DEV);
const apiKey = env === 'prod' ? process.env._API_KEY : (env === 'stage' ? process.env._API_KEY_STAGE : process.env._API_KEY_DEV);

// Variable to store the created stream ID
let createdStreamId = null;

test('Create stream', async () => {
  // Get credentials from environment variables
  if (!apiKey) {
    throw new Error('API key not found in environment variables');
  }

  // Construct curl command based on platform
  const isWindows = process.platform === 'win32';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const curlCmd = `curl -k -X POST https:^/^/${hostAPI}^/v2^/channel -H "X-Api-Key: ${apiKey}" -H "X-Format: default" -H "Content-Type: application/json" -d "{\\\"title\\\":\\\"Test HLS Stream ${timestamp}\\\",\\\"description\\\":\\\"Created via API test\\\",\\\"channel_type\\\":\\\"hls\\\"}"`;

  // Mask API key for logging
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);

  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(stdout);
      
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

      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n');

      // Store the stream ID if the request was successful
      if (response.id) {
        createdStreamId = response.id;
        console.log(`Created stream ID: ${createdStreamId}`);
      }
    } catch (e) {
      console.log('\n=== Raw API Response ===');
      console.log(stdout);
      console.log('=======================\n');
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
  const curlCmd = `curl -k -X GET https:^/^/${hostAPI}^/v2^/channel^/${createdStreamId} -H "X-Api-Key: ${apiKey}" -H "X-Format: default"`;

  // Выводим команду в консоль (маскируем API ключ для безопасности)
  const maskedCmd = curlCmd.replace(apiKey, 'XXXXX');
  console.log('Executing curl command:', maskedCmd);
  
  try {
    console.log(`Executing request for environment: ${env}`);
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Parse and format the JSON response for better readability
    try {
      const response = JSON.parse(stdout);
      
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

      console.log('\n=== API Response ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('===================\n');
    } catch (e) {
      console.log('\n=== Raw API Response ===');
      console.log(stdout);
      console.log('=======================\n');
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    throw error;
  }
});
