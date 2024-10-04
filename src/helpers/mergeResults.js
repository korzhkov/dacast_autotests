const fs = require('fs');
const path = require('path');

// Function to merge new test results with existing results
function mergeResults(existingResults, newResults) {
  console.log('Merging results');
  
  // If there are no existing results, return the new results
  if (!existingResults || typeof existingResults !== 'object') {
    return newResults;
  }

  // If there are no new results, return the existing results
  if (!newResults || typeof newResults !== 'object') {
    return existingResults;
  }

  // Merge statistics from both results
  const mergedStats = {
    startTime: existingResults.stats?.startTime || newResults.stats?.startTime,
    duration: (existingResults.stats?.duration || 0) + (newResults.stats?.duration || 0),
    expected: (existingResults.stats?.expected || 0) + (newResults.stats?.expected || 0),
    skipped: (existingResults.stats?.skipped || 0) + (newResults.stats?.skipped || 0),
    unexpected: (existingResults.stats?.unexpected || 0) + (newResults.stats?.unexpected || 0),
    flaky: (existingResults.stats?.flaky || 0) + (newResults.stats?.flaky || 0)
  };

  // Return merged results
  return {
    ...existingResults,
    suites: [...(existingResults.suites || []), ...(newResults.suites || [])],
    errors: [...(existingResults.errors || []), ...(newResults.errors || [])],
    stats: mergedStats
  };
}

// Function to update existing results with new results
function updateResults(existingResults, newResults) {
  console.log('Updating results');
    

  // If there are no existing results, return the new results
  if (!existingResults || Object.keys(existingResults).length === 0) {
    return newResults;
  }

  // If there are no new results, return the existing results
  if (!newResults || Object.keys(newResults).length === 0) {
    console.log('New results are empty or invalid');
    return existingResults;
  }

  // Update statistics
  const updatedStats = {
    startTime: existingResults.stats?.startTime || newResults.stats?.startTime,
    duration: (existingResults.stats?.duration || 0) + (newResults.stats?.duration || 0),
    expected: (existingResults.stats?.expected || 0) + (newResults.stats?.expected || 0),
    skipped: (existingResults.stats?.skipped || 0) + (newResults.stats?.skipped || 0),
    unexpected: (existingResults.stats?.unexpected || 0) + (newResults.stats?.unexpected || 0),
    flaky: (existingResults.stats?.flaky || 0) + (newResults.stats?.flaky || 0)
  };

  // Combine suites and errors from both results
  const updatedSuites = [...(existingResults.suites || []), ...(newResults.suites || [])];
  const updatedErrors = [...(existingResults.errors || []), ...(newResults.errors || [])];

  return {
    ...existingResults,
    suites: updatedSuites,
    errors: updatedErrors,
    stats: updatedStats
  };
}

function saveResults(resultsPath, mergedResults) {
  const resultsFile = path.join(resultsPath, 'results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(mergedResults, null, 2));
}

module.exports = { mergeResults, updateResults, saveResults };