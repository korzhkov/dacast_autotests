const { test } = require('@playwright/test');
const { execSync } = require('child_process');
const config = require('./playwright.config.js');

// Define valid environments
const validEnvs = ['prod', 'stage', 'dev'];

// Skip first two arguments (node and script path)
const specifiedEnv = process.argv.slice(2).find(arg => 
    !arg.startsWith('--') && validEnvs.includes(arg)
);

// If environment is specified but invalid, show error
const invalidEnv = process.argv.slice(2).find(arg => 
    !arg.startsWith('--') && !validEnvs.includes(arg)
);

if (invalidEnv) {
    console.error(`[${new Date().toISOString()}] Error: Invalid environment "${invalidEnv}"`);
    console.error(`Valid environments are: ${validEnvs.join(', ')}`);
    console.error('Example usage: node runTests2.js prod --tests=chat,trial --sequential');
    process.exit(1);
}

// Use specified env or default to 'prod'
const env = specifiedEnv || 'prod';

// Get available tests from playwright config (excluding 'chrome' project)
const availableTests = config.projects
    .map(project => project.name)
    .filter(name => name !== 'chrome');

console.log(`[${new Date().toISOString()}] Available tests:`, availableTests);

let testsToRun = [];

// Parse command line arguments (skip node and filename)
const args = process.argv.slice(2);
console.log(`[${new Date().toISOString()}] Command line arguments:`, args);

args.forEach(arg => {
    if (arg.startsWith('--tests=')) {
        const testParam = arg.split('=')[1];
        console.log(`[${new Date().toISOString()}] Test parameter:`, testParam);
        
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
            console.log(`[${new Date().toISOString()}] Requested tests:`, requestedTests);
            testsToRun = requestedTests.filter(test => availableTests.includes(test));
            console.log(`[${new Date().toISOString()}] Filtered tests:`, testsToRun);
        }
    }
});

// If no tests specified, run all available tests
if (testsToRun.length === 0) {
    console.log(`[${new Date().toISOString()}] No tests selected, running all available tests`);
    testsToRun = availableTests;
}

// Check if tests should run sequentially
const isSequential = process.argv.includes('--sequential');

async function runTests() {
    console.log(`[${new Date().toISOString()}] Current directory:`, process.cwd());
    console.log(`[${new Date().toISOString()}] Starting test sequence in ${env.toUpperCase()} environment`);
    console.log(`[${new Date().toISOString()}] Running tests: ${testsToRun.join(', ')}`);
    
    // Добавляем список тестов в переменные окружения
    process.env.TESTS_TO_RUN = JSON.stringify(testsToRun);
    
    const projectFlags = testsToRun.map(test => `--project=${test}`).join(' ');
    const workers = isSequential ? '--workers=1' : '';
    
    const isWindows = process.platform === 'win32';
    const command = isWindows
        ? `npx playwright test --config=playwright.config.js ${projectFlags} ${workers}`
        : `xvfb-run npx playwright test --config=playwright.config.js ${projectFlags} ${workers}`;
        
    console.log(`[${new Date().toISOString()}] Running command: ${command}`);
    
    try {
        process.env.WORKENV = env;
        execSync(command, { 
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: 'inherit'
        });

        // Если дошли до этой точки без исключений, значит тесты прошли успешно
        return { success: true };
    } catch (error) {
        // Проверяем вывод на наличие строки "X passed"
        const output = error.stdout || '';
        if (output.includes(' passed (') && !output.includes(' failed')) {
            // Тесты прошли успешно, несмотря на ошибку xvfb
            return { success: true };
        }
        
        // Реальная ошибка в тестах
        console.error(`[${new Date().toISOString()}] Error running tests:`, {
            message: error.message,
            stdout: error.stdout,
            stderr: error.stderr
        });
        
        return { 
            success: false, 
            error: error.message
        };
    }
}

// Запускаем тесты и обрабатываем результат
const result = runTests().catch(error => {
    console.error('Unexpected error:', error);
    return { success: false, error: error.message };
});

if (result.success) {
    process.exit(0);
} else {
    process.exit(1);
}