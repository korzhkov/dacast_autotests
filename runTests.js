const { execSync } = require('child_process');

// To run all tests one by one: npm run test:all; Sequene as follows:
const tests = [
  'test:upload',
  'test:playlist',
  'test:stream',
  'test:vod2live',
  'test:folder',
  'test:expo',
  'test:chat',
  'test:trial'
];

for (const test of tests) {
  console.log(`Running ${test}...`);
  try {
    execSync(`npm run ${test}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error in ${test}:`, error);
    process.exit(1);
  }
}