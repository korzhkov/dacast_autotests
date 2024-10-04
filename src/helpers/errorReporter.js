const fs = require('fs');
const path = require('path');

// Function to summarize test results
function summarizeResults(results) {
  console.log('Summarizing results');

  // Check if results object is valid
  if (!results || typeof results !== 'object') {
    console.log('Invalid results object');
    return { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, duration: 0 };
  }

  // Initialize counters
  let totalTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  let duration = 0;

  // Iterate through test suites, specs, and tests
  if (results.suites && Array.isArray(results.suites)) {
    results.suites.forEach(suite => {
      if (suite.specs && Array.isArray(suite.specs)) {
        suite.specs.forEach(spec => {
          if (spec.tests && Array.isArray(spec.tests)) {
            spec.tests.forEach(test => {
              if (test.results && Array.isArray(test.results)) {
                const lastResult = test.results[test.results.length - 1];
                if (lastResult && lastResult.steps) {
                  // Count steps as individual tests
                  totalTests += lastResult.steps.length;
                  lastResult.steps.forEach(step => {
                    if (step.error) {
                      failedTests++;
                    }
                  });
                }
                // Count stderr messages as failed tests
                if (lastResult && lastResult.stderr) {
                  failedTests += lastResult.stderr.length;
                }
                duration += lastResult.duration || 0;
              }
            });
          }
        });
      }
    });
  }

  // Calculate passedTests by subtracting failedTests from totalTests
  const passedTests = Math.max(0, totalTests - failedTests - skippedTests);

  // Return summary object
  return { totalTests, passedTests, failedTests, skippedTests, duration };
}

// Function to generate error report
async function generateErrorReport(resultsPath) {
  const errorReportPath = path.join(__dirname, '..', '..', 'error_report.txt');
  let reportContent = 'Error Report:\n\n';

  const resultsFilePath = path.join(resultsPath, 'results.json');
  if (fs.existsSync(resultsFilePath)) {
    const results = JSON.parse(fs.readFileSync(resultsFilePath, 'utf8'));
    const summary = summarizeResults(results);

    // Generate report for failed tests
    if (summary.failedTests > 0) {
      results.suites.forEach(suite => {
        suite.specs.forEach(spec => {
          spec.tests.forEach(test => {
            if (test.results && test.results[0] && test.results[0].status === 'failed') {
              reportContent += `Test: ${test.title || 'Unnamed test'}\n`;
              reportContent += `File: ${suite.file}\n`;
              reportContent += `Error: ${test.results[0].error?.message || 'Unknown error'}\n\n`;
            }
          });
        });
      });
    } else {
      reportContent += 'No failed tests.\n';
    }

    // Add summary to the report
    reportContent += `Total Tests: ${summary.totalTests}\n`;
    reportContent += `Passed Tests: ${summary.passedTests}\n`;
    reportContent += `Failed Tests: ${summary.failedTests}\n`;
    reportContent += `Skipped Tests: ${summary.skippedTests}\n`;
    reportContent += `Duration: ${summary.duration} ms\n`;
  } else {
    reportContent += 'No test results found.\n';
  }
  // Write the error report to a file
  await fs.promises.writeFile(errorReportPath, reportContent);
  console.log(`Error report generated: ${errorReportPath}`);
    
  // Return the generated report content
  return reportContent;
}

module.exports = { generateErrorReport, summarizeResults };