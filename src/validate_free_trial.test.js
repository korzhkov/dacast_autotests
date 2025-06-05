const { test, expect } = require('@playwright/test');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Get host based on environment
const env = process.env.WORKENV || 'prod';
let host;
if (env === 'stage') {
  host = process.env._HOST_STAGE;
} else if (env === 'dev') {
  host = process.env._HOST_DEV;
} else {
  host = process.env._HOST;
}

// Lists of first names and last names
const firstNames = [
  'John', 'Alice', 'Michael', 'Emma', 'David', 'Olivia', 'William', 'Sophia', 'James', 'Ava',
  'Mohammed', 'Yuki', 'Wei', 'Maria', 'Juan', 'Fatima', 'Ivan', 'Aisha', 'Chen', 'Sven',
  'Priya', 'Hiroshi', 'Olga', 'Ahmed', 'Ingrid', 'Carlos', 'Mei', 'Hans', 'Amelia', 'Raj',
  'Liam', 'Zoe', 'Mateo', 'Chloe', 'Noah', 'Sofia', 'Ethan', 'Mia', 'Oliver', 'Charlotte',
  'Muhammad', 'Emily', 'Aarav', 'Isabella', 'Alexander', 'Sophie', 'Daniel', 'Evelyn', 'Lucas', 'Harper'
];
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Kim', 'Lee', 'Wang', 'Zhang', 'Chen', 'Nguyen', 'Patel', 'Singh', 'Kumar', 'Müller',
  'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer',
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
  'Silva', 'Santos', 'Oliveira', 'Pereira', 'Ferreira', 'Rodrigues', 'Almeida', 'Costa', 'Carvalho', 'Gomes'
];

// List of domains
const domains = [
  'vimeo.com', 'adobe.com', 'blackmagicdesign.com', 'avid.com',
  'finalcutpro.com', 'wondershare.com', 'magix.com',
  'vegascreativesoftware.com', 'cyberlink.com', 'corel.com', 'movavi.com',
  'techsmith.com', 'telestream.net', 'nvidia.com', 'encoding.com', 'ffmpeg.org',
  'openshot.org', 'shotcut.org', 'kdenlive.org', 'lightworks.com', 'nchsoftware.com',
  'videolan.org', 'avidemux.org', 'opencoloriosystem.com', 'handbrake.fr',
  'mltframework.org', 'blender.org', 'obs-studio.org', 'streamlabs.com',
  'restream.io', 'wowza.com', 'panopto.com', 'sproutvideo.com',
  'vidyard.com', 'brightcove.com', 'jwplayer.com', 'vevo.com',
  'dailymotion.com', 'instagram.com', 'snapchat.com', 'linkedin.com', 'pinterest.com'
];

let randomDomain = getRandomElement(domains);

// Function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Function to generate a random password
function generateRandomPassword(length = 16) {
  const charset = "a-zA-Z0-9!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

// Function to generate a random US phone number
function generateUSPhoneNumber() {
  const areaCode = Math.floor(Math.random() * 800) + 200;
  const firstPart = Math.floor(Math.random() * 900) + 100;
  const secondPart = Math.floor(Math.random() * 9000) + 1000;
  return `+1 ${areaCode} ${firstPart} ${secondPart}`;
}

test('Dacast free trial test', async ({ page }) => {
  test.setTimeout(180000); // Increase the overall test timeout to 3 minutes

  // Setup network logging
  const networkLogs = [];
  const startTime = Date.now();

  // Listen to all network requests
  page.on('request', request => {
    networkLogs.push({
      timestamp: Date.now() - startTime,
      type: 'request',
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
    });
  });

  // Listen to all network responses
  page.on('response', response => {
    networkLogs.push({
      timestamp: Date.now() - startTime,
      type: 'response',
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      statusText: response.statusText(),
      ok: response.ok()
    });
  });

  console.log('Starting test');

  await test.step('Navigate to Free Trial page', async () => {
    try {
      await page.goto(`https://${host}/signup?autotest=true`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 120000 
      });
      console.log('Page loaded successfully');
    } catch (error) {
      console.error('Error loading page:', error);
      throw error;
    }
    await page.waitForTimeout(2000);
  });

  const cookieBanner = page.getByRole('heading', { name: 'This website uses cookies' });
  if (await cookieBanner.isVisible()) {
    await page.getByRole('button', { name: 'OK' }).click();
  }

  await test.step('Fill out the Free Trial form', async () => {
    console.log('Filling out the form');

    await page.locator('#email').click();
    // This line generates a random email address in the format: yk_XXXXXX@domain where X is either:
    // 1. A random lowercase letter (a-z) if Math.random() < 0.5
    // 2. A random digit (0-9) if Math.random() >= 0.5
    // 
    // Breaking it down:
    // - Array(6).fill() creates array of 6 empty elements
    // - .map() transforms each element using the random generator function
    // - Math.random() < 0.5 gives 50/50 chance of letter vs number
    // - String.fromCharCode(97 + Math.random() * 26) generates random lowercase letter
    //   (97 is ASCII for 'a', adding random 0-25 gives a-z)
    // - Math.floor(Math.random() * 10) generates random digit 0-9
    // - .join('') combines the 6 random chars into a single string
    // - Prefixed with 'yk_' and suffixed with @randomDomain
    await page.locator('#email').fill(`yk_${Array(6).fill().map(() => Math.random() < 0.5 ? String.fromCharCode(97 + Math.floor(Math.random() * 26)) : Math.floor(Math.random() * 10)).join('')}@${randomDomain}`);
    

    // Select a random first name and last name
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);

    console.log(`Using name: ${firstName} ${lastName}`);

    await page.locator('#firstName').click();
    for (const char of firstName) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.locator('#firstName').press('Tab');

    for (const char of lastName) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    
    await page.locator('#lastName').press('Tab');
    // Generate a random US phone number
    const phoneNumber = generateUSPhoneNumber();
    console.log(`Using phone number: ${phoneNumber}`);

    await page.locator('#tel').click();
    for (const char of phoneNumber) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.locator('#tel').press('Tab');
    await page.locator('#url').click();
    await page.locator('#url').fill('');
    
    console.log(`Using domain: ${randomDomain}`);
    for (const char of `https://${randomDomain}`) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    await page.locator('#url').press('Tab');
    
    // Generate a random password
    const randomPassword = generateRandomPassword();
    console.log(`Using password: ${randomPassword}`);

    await page.locator('#password').click();
    for (const char of randomPassword) {
      await page.keyboard.type(char, { delay: Math.floor(Math.random() * (250 - 50 + 1)) + 50 });
    }
    
    console.log('Form filled out');

    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Sign up free' }).click();
    console.log('Signup button clicked');

  });
  await page.waitForTimeout(5000);
  await test.step('Validate Dashboard', async () => {
    try {
      await expect(page.getByText(/Welcome, .+!/)).toBeVisible({ timeout: 120000 });
      console.log('Welcome message is visible');
    } catch (error) {
      console.error('Test did not complete: Welcome is not visible');
      
      // Take a screenshot for debugging
      console.log('Taking screenshot of the failed welcome message validation');
      const screenshotDir = './historical-screenshots';
      
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      const screenshotPath = `${screenshotDir}/free-trial-welcome-failed-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      console.log(`Saving screenshot to: ${screenshotPath}`);
      
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });

      test.fail();
      testFailed = true;
    }
  });

  // Save network logs regardless of test result
  const resultsDir = path.join(process.cwd(), 'test-results');
  console.log('Results directory:', resultsDir);
  
  // Log network logs count
  console.log('Number of network logs:', networkLogs.length);
  if (networkLogs.length === 0) {
    console.log('Warning: No network logs collected!');
  }
  
  // Save JSON logs
  const jsonLogPath = path.join(resultsDir, 'network-logs.json');
  console.log('Saving JSON logs to:', jsonLogPath);
  try {
    fs.writeFileSync(jsonLogPath, JSON.stringify(networkLogs, null, 2));
    console.log('JSON logs saved successfully');
  } catch (error) {
    console.error('Error saving JSON logs:', error);
  }

  // Convert network logs to HAR format
  const harData = {
    log: {
      version: "1.2",
      creator: {
        name: "Playwright",
        version: "1.0"
      },
      browser: {
        name: "Playwright",
        version: "1.0"
      },
      pages: [],
      entries: []
    }
  };

  // Group requests and responses by URL
  const requestMap = new Map();
  networkLogs.forEach(log => {
    if (log.type === 'request') {
      requestMap.set(log.url, {
        request: {
          method: log.method,
          url: log.url,
          httpVersion: "HTTP/1.1",
          cookies: [],
          headers: Object.entries(log.headers).map(([name, value]) => ({ name, value })),
          queryString: [],
          headersSize: -1,
          bodySize: log.postData ? log.postData.length : 0,
          postData: log.postData ? { text: log.postData } : undefined
        },
        timestamp: log.timestamp
      });
    } else if (log.type === 'response') {
      const request = requestMap.get(log.url);
      if (request) {
        harData.log.entries.push({
          startedDateTime: new Date(startTime + request.timestamp).toISOString(),
          time: log.timestamp - request.timestamp,
          request: request.request,
          response: {
            status: parseInt(log.status),
            statusText: log.statusText,
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: Object.entries(log.headers).map(([name, value]) => ({ name, value })),
            content: {
              size: 0,
              mimeType: log.headers['content-type'] || 'text/plain',
              text: ""
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: 0
          },
          cache: {},
          timings: {
            send: 0,
            wait: log.timestamp - request.timestamp,
            receive: 0
          }
        });
      }
    }
  });

  // Save HAR file
  const harLogPath = path.join(resultsDir, 'network-logs.har');
  console.log('Saving HAR file to:', harLogPath);
  try {
    fs.writeFileSync(harLogPath, JSON.stringify(harData, null, 2));
    console.log('HAR file saved successfully');
  } catch (error) {
    console.error('Error saving HAR file:', error);
  }

  console.log('Test completed');
});