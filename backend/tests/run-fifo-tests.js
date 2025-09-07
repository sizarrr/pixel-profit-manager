#!/usr/bin/env node

// Comprehensive FIFO test runner
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const runTest = (testPath, description) => {
  return new Promise((resolve, reject) => {
    log(`\n${colors.cyan}Running ${description}...${colors.reset}`);
    
    const testProcess = spawn('npm', ['test', testPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log(`${colors.green}✓ ${description} passed${colors.reset}`);
        resolve();
      } else {
        log(`${colors.red}✗ ${description} failed${colors.reset}`);
        reject(new Error(`${description} failed with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      log(`${colors.red}Error running ${description}: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
};

const main = async () => {
  log(`${colors.bright}${colors.blue}🧪 FIFO Implementation Test Suite${colors.reset}`);
  log(`${colors.bright}====================================${colors.reset}\n`);

  const testSuites = [
    {
      path: 'tests/unit/fifo-allocation.test.js',
      description: 'Unit Tests - FIFO Allocation Logic'
    },
    {
      path: 'tests/integration/fifo-sales.test.js',
      description: 'Integration Tests - FIFO Sales Workflow'
    },
    {
      path: 'tests/edge-cases/fifo-edge-cases.test.js',
      description: 'Edge Case Tests - FIFO Error Scenarios'
    },
    {
      path: 'tests/performance/fifo-performance.test.js',
      description: 'Performance Tests - FIFO Scalability'
    }
  ];

  const results = {
    passed: 0,
    failed: 0,
    total: testSuites.length
  };

  const startTime = Date.now();

  for (const suite of testSuites) {
    try {
      await runTest(suite.path, suite.description);
      results.passed++;
    } catch (error) {
      results.failed++;
      log(`${colors.yellow}Continuing with remaining tests...${colors.reset}`);
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  log(`\n${colors.bright}${colors.blue}Test Results Summary${colors.reset}`);
  log(`${colors.bright}===================${colors.reset}`);
  log(`Total Test Suites: ${results.total}`);
  log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  log(`Duration: ${duration}s`);

  if (results.failed === 0) {
    log(`\n${colors.green}${colors.bright}🎉 All FIFO tests passed! Your implementation is solid.${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.red}${colors.bright}❌ Some tests failed. Please review the output above.${colors.reset}`);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  log(`\n${colors.yellow}Test execution interrupted${colors.reset}`);
  process.exit(1);
});

main().catch((error) => {
  log(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});