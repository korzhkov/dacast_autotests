const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const { mergeResults, updateResults, saveResults } = require('./src/helpers/mergeResults');
const { summarizeResults } = require('./src/helpers/errorReporter');

console.log('Arguments:', process.argv);

const args = process.argv.slice(2);
console.log('Parsed arguments:', args);

const isAllTests = args[0] === 'test:all' || args[0] === 'test:all:startfrom';
const startFromTest = args[1];

console.log('Is all tests:', isAllTests);
console.log('Start from test:', startFromTest);

const testFileNames = {
  //'test:clean': 'cleaner.test.js',
  'test:analytics': 'validate_analytics.test.js',
  'test:upload': 'upload_video.test.js',
  'test:playlist': 'create_playlist.test.js',
  'test:expo': 'create_expo.test.js',
  'test:schedule': 'create_schedule.test.js',
  'test:folder': 'create_folder.test.js',
  'test:stream': 'create_stream.test.js',
  'test:vod2live': 'create_vod2live.test.js',
  'test:trial': 'validate_free_trial.test.js',
  'test:chat': 'validate_chat.test.js',
 // 'test:clean': 'cleaner.test.js',
  //'test:quick': 'quick.test.js',
  //'test:quick2': 'quick2.test.js'
  
};

const allTests = Object.keys(testFileNames);
console.log('All tests:', allTests);

let testsToRun = isAllTests ? allTests : [args[0]];

if (startFromTest) {
  const startIndex = allTests.indexOf(startFromTest);
  if (startIndex !== -1) {
    testsToRun = allTests.slice(startIndex);
  } else {
    console.error(`Error: Start test "${startFromTest}" not found in the test list.`);
    process.exit(1);
  }
}

console.log('Tests to run:', testsToRun);

async function runTestsSequentially() {
  const resultsPath = path.join(__dirname, 'test-results');
  let mergedResults = {};

  console.log(`Starting test run at ${new Date().toISOString()}`);

  for (const currentTest of testsToRun) {
    const testFileName = testFileNames[currentTest];
    
    if (!testFileName) {
      console.error(`Error: No file name mapping found for test ${currentTest}`);
      continue;
    }

    console.log(`Running test: ${currentTest}`);
    try {
      execSync(`npx playwright test src/${testFileName} --headed`, { stdio: 'inherit' });
      console.log(`Test ${currentTest} completed successfully.`);
      
      const resultsFilePath = path.join(resultsPath, 'results.json');
      if (fs.existsSync(resultsFilePath)) {
        const newResults = JSON.parse(fs.readFileSync(resultsFilePath, 'utf8'));
        //console.log(`Raw results for ${currentTest}:`, JSON.stringify(newResults, null, 2));
        mergedResults = updateResults(mergedResults, newResults);
        
        const summary = summarizeResults(mergedResults);
        console.log(`Results summary for ${currentTest}:`, summary);
      } else {
        console.log(`No results file found for ${currentTest}`);
      }
    } catch (error) {
      console.error(`Error running ${currentTest}:`, error);
    }
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const versionedResultsPath = path.join(resultsPath, `results_${timestamp}.json`);

  if (Object.keys(mergedResults).length > 0) {
    try {
      fs.writeFileSync(versionedResultsPath, JSON.stringify(mergedResults, null, 2));
      console.log(`Results saved to ${versionedResultsPath}`);
    } catch (error) {
      console.error('Error saving results:', error);
    }
    console.log('Final summary of results:', summarizeResults(mergedResults));
  } else {
    console.log('No test results were generated.');
  }

  console.log(`Test run completed at ${new Date().toISOString()}`);
}

runTestsSequentially().catch(console.error);