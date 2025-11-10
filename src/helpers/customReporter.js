const { sendToSlack } = require('./slackNotifier');
const ResultsManager = require('./resultsManager');
const fs = require('fs');
const path = require('path');

/**
 * Custom reporter for Playwright tests that tracks test execution and sends notifications
 */
class CustomReporter {
    constructor(options = {}) {
        this.config = require('../../playwright.config.js');
        this.testResults = { passed: 0, failed: 0, skipped: 0, flaky: 0 };
        
        const defaultConfig = { outputDir: 'test-results' };
        this.resultsManager = new ResultsManager(options.config || defaultConfig);
        this.resultsManager.init();

        // Get environment from process.env
        this.environment = process.env.WORKENV || 'prod';
        
        // Create status file directory if it doesn't exist
        this.statusFilePath = path.join('results', this.environment);
        if (!fs.existsSync(this.statusFilePath)) {
            fs.mkdirSync(this.statusFilePath, { recursive: true });
        }

        // Set full path to status file
        this.statusFile = path.join(this.statusFilePath, 'test-status.json');

        // Initialize status file for selected tests
        this.initializeStatusFile();
    }

    initializeStatusFile() {
        try {
            const testsToRun = JSON.parse(process.env.TESTS_TO_RUN || '[]');
            const initialStatuses = {
                _meta: {
                    created: new Date().toISOString(),
                    lastUpdate: new Date().toISOString(),
                    environment: this.environment
                }
            };
            
            testsToRun.forEach(test => {
                initialStatuses[test] = {
                    status: 'pending',
                    startTime: null,
                    endTime: null,
                    duration: null
                };
            });
            
            fs.writeFileSync(this.statusFile, JSON.stringify(initialStatuses, null, 2));
        } catch (error) {
            console.error('Error initializing test statuses:', error);
        }
    }

    async onTestBegin(test) {
        try {
            const testFile = path.basename(test.location.file);
            const testName = this.getTestName(testFile);
            
            console.log(`[${new Date().toISOString()}] Starting test: ${testName}`);
            
            const statuses = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
            
            if (!statuses[testName]) {
                console.error(`[${new Date().toISOString()}] Test ${testName} not found in status file`);
                return;
            }

            statuses._meta.lastUpdate = new Date().toISOString();
            statuses[testName] = {
                status: 'running',
                startTime: new Date().toISOString(),
                endTime: null,
                duration: null
            };

            fs.writeFileSync(this.statusFile, JSON.stringify(statuses, null, 2));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in onTestBegin:`, error);
        }
    }

    async onTestEnd(test, result) {
        try {
            const testFile = path.basename(test.location.file);
            const testName = this.getTestName(testFile);
            
            const statuses = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
            const startTime = statuses[testName].startTime;
            const endTime = new Date().toISOString();
            
            const duration = startTime ? 
                `${((new Date(endTime)).getTime() - (new Date(startTime)).getTime()) / 1000}s` : 
                null;

            // Check if test has 'flaky' annotation (annotations are in test object, not result)
            const isFlakyTest = test.annotations?.some(annotation => annotation.type === 'flaky');

            statuses[testName] = {
                status: isFlakyTest ? 'flaky' : result.status,
                startTime,
                endTime,
                duration
            };

            fs.writeFileSync(this.statusFile, JSON.stringify(statuses, null, 2));

            if (result.status === 'passed') {
                if (isFlakyTest) {
                    this.testResults.flaky++;
                    const flakyAnnotation = test.annotations.find(a => a.type === 'flaky');
                    const flakyReason = flakyAnnotation?.description || 'Test marked as flaky';
                    await sendToSlack(`Test passed but marked as FLAKY: ${test.title}\n${flakyReason}`, test.title, 'warning');
                } else {
                    this.testResults.passed++;
                    await sendToSlack(`Test passed: ${test.title}`, test.title, 'info');
                }
            } else if (result.status === 'failed' || result.status === 'timedOut') {
                this.testResults.failed++;
                await sendToSlack(`Test failed: ${test.title}`, test.title, 'error');
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in onTestEnd:`, error);
        }
    }

    async onEnd() {
        const summary = `Test run completed.
Total: ${this.testResults.passed + this.testResults.failed + this.testResults.skipped + this.testResults.flaky}
Passed: ${this.testResults.passed}
Failed: ${this.testResults.failed}
Flaky: ${this.testResults.flaky}
Skipped: ${this.testResults.skipped}`;

        await sendToSlack(summary, 'Test Run Summary');
        this.resultsManager.saveResults();
    }

    getTestName(testFile) {
        let testName = testFile.replace('.test.js', '');
        
        const project = this.config.projects.find(p => {
            if (!p.testMatch) return false;
            const patterns = Array.isArray(p.testMatch) ? p.testMatch : [p.testMatch];
            return patterns.some(pattern => {
                const cleanPattern = pattern.replace(/\*\*\/|\*/g, '');
                return testName === cleanPattern.replace('.test.js', '');
            });
        });

        return project ? project.name : testName;
    }
}

module.exports = CustomReporter;