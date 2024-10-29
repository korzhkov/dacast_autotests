const { test } = require('@playwright/test');
const { execSync } = require('child_process');
const config = require('./playwright.config.js');

// Define valid environments
const validEnvs = ['prod', 'stage', 'dev'];
const env = process.argv.find(arg => validEnvs.includes(arg)) || 'prod';

// Get available tests from playwright config (excluding 'chrome' project)
const availableTests = config.projects
    .map(project => project.name)
    .filter(name => name !== 'chrome');

let testsToRun = [];

// Parse command line arguments (skip node and filename)
const args = process.argv.slice(2);
args.forEach(arg => {
    if (arg.startsWith('--tests=')) {
        const testParam = arg.split('=')[1];
        
        // Check if startfrom: option is used
        if (testParam.startsWith('startfrom:')) {
            const startTest = testParam.split(':')[1];
            const startIndex = availableTests.indexOf(startTest);
            if (startIndex !== -1) {
                // Get all tests starting from the specified one
                testsToRun = availableTests.slice(startIndex);
            }
        } else {
            // Regular comma-separated list of tests
            const requestedTests = testParam.split(',');
            testsToRun = requestedTests.filter(test => availableTests.includes(test));
        }
    }
});

// If no tests specified, run all available tests
if (testsToRun.length === 0) {
    testsToRun = availableTests;
}

// Check if tests should run sequentially
const isSequential = process.argv.includes('--sequential');

async function runTests() {
    console.log(`[${new Date().toISOString()}] Starting test sequence in ${env.toUpperCase()} environment`);
    console.log(`[${new Date().toISOString()}] Running tests: ${testsToRun.join(', ')}`);
    
    // Create project flags for each test
    const projectFlags = testsToRun.map(test => `--project=${test}`).join(' ');
    const workers = isSequential ? '--workers=1' : '';
    
    const command = `npx playwright test --config=playwright.config.js ${projectFlags} ${workers}`;
    console.log(`[${new Date().toISOString()}] Running command: ${command}`);
    
    try {
        // Pass environment through process.env
        process.env.WORKENV = env;
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error running tests:`, error);
    }
}

console.log(`[${new Date().toISOString()}] Script started for ${env.toUpperCase()}`);
runTests().catch(console.error);
