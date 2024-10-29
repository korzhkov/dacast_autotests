const { sendToSlack } = require('./slackNotifier');
const ResultsManager = require('./resultsManager');

class CustomReporter {
  constructor(options = {}) {
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    const defaultConfig = {
      outputDir: 'test-results'
    };
    this.resultsManager = new ResultsManager(options.config || defaultConfig);
    this.resultsManager.init();
  }

  onTestBegin(test) {
    this.testResults.totalTests++;
    console.log(`Starting test: ${test.title}`);
  }

  async onTestEnd(test, result) {
    console.log(`Test ended: ${test.title} with status ${result.status}`);

    if (result.status === 'passed') {
      this.testResults.passed++;
      await sendToSlack(`Test passed: ${test.title}`, test.title, 'info');
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      this.testResults.failed++;
      
      let errorMessage, errorStack;
      
      if (result.status === 'timedOut') {
        errorMessage = `Test timeout exceeded (${test.timeout}ms)`;
        errorStack = `at ${test.location?.file}:${test.location?.line}`;
      } else {
        errorMessage = result.error?.message || 'Unknown error';
        errorStack = result.error?.stack || 'No stack trace available';
      }

      await sendToSlack(`
Test failed: ${test.title}
Error: ${errorMessage}
Stack trace:
${errorStack}
      `, test.title, 'error');
    } else if (result.status === 'skipped') {
      this.testResults.skipped++;
      await sendToSlack(`Test skipped: ${test.title}`, test.title, 'info');
    }
  }

  async onEnd() {
    const summary = `
Test run completed.
Total: ${this.testResults.totalTests}
Passed: ${this.testResults.passed}
Failed: ${this.testResults.failed}
Skipped: ${this.testResults.skipped}
    `;

    await sendToSlack(summary, 'Test Run Summary');
    
    // Сохраняем результаты в отдельную папку
    this.resultsManager.saveResults();
  }
}

module.exports = CustomReporter;