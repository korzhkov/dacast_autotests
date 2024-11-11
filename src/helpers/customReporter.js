const { sendToSlack } = require('./slackNotifier');
const ResultsManager = require('./resultsManager');

/**
 * Custom reporter for Playwright tests that tracks test execution and sends notifications
 * Implements the Reporter API interface from Playwright
 */
class CustomReporter {
  /**
   * Initialize reporter with optional configuration
   * @param {Object} options - Reporter configuration options
   */
  constructor(options = {}) {
    // Track test execution statistics
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    // Set default configuration for results storage
    const defaultConfig = {
      outputDir: 'test-results'
    };

    // Initialize results manager with provided or default config
    this.resultsManager = new ResultsManager(options.config || defaultConfig);
    this.resultsManager.init();
  }

  /**
   * Called when a test starts running
   * @param {Object} test - Test information object from Playwright
   */
  onTestBegin(test) {
    this.testResults.totalTests++;
    console.log(`Starting test: ${test.title}`);
  }

  /**
   * Called when a test finishes running
   * Sends appropriate Slack notifications based on test result
   * @param {Object} test - Test information object
   * @param {Object} result - Test result object containing status and error details
   */
  async onTestEnd(test, result) {
    console.log(`Test ended: ${test.title} with status ${result.status}`);

    // Handle successful test completion
    if (result.status === 'passed') {
      this.testResults.passed++;
      await sendToSlack(`Test passed: ${test.title}`, test.title, 'info');
    } 
    // Handle test failures and timeouts
    else if (result.status === 'failed' || result.status === 'timedOut') {
      this.testResults.failed++;
      
      let errorMessage, errorStack;
      
      // Special handling for timeout failures
      if (result.status === 'timedOut') {
        errorMessage = `Test timeout exceeded (${test.timeout}ms)`;
        errorStack = `at ${test.location?.file}:${test.location?.line}`;
      } 
      // Handle other types of failures
      else {
        errorMessage = result.error?.message || 'Unknown error';
        errorStack = result.error?.stack || 'No stack trace available';
      }

      // Send detailed error information to Slack
      await sendToSlack(`
Test failed: ${test.title}
Error: ${errorMessage}
Stack trace:
${errorStack}
      `, test.title, 'error');
    } 
    // Handle skipped tests
    else if (result.status === 'skipped') {
      this.testResults.skipped++;
      await sendToSlack(`Test skipped: ${test.title}`, test.title, 'info');
    }
  }

  /**
   * Called when all tests have finished running
   * Sends summary to Slack and saves final results
   */
  async onEnd() {
    // Prepare summary of all test results
    const summary = `
Test run completed.
Total: ${this.testResults.totalTests}
Passed: ${this.testResults.passed}
Failed: ${this.testResults.failed}
Skipped: ${this.testResults.skipped}
    `;

    // Send final summary to Slack
    await sendToSlack(summary, 'Test Run Summary');
    
    // Save test results to filesystem using ResultsManager
    this.resultsManager.saveResults();
  }
}

module.exports = CustomReporter;